import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const saleSchema = z.object({
  customerId: z.string().min(1).optional(),
  cashAccountId: z.string().min(1).optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'QR', 'CREDIT']),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
  })).min(1),
})

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function saleNumber() {
  return `V-${Date.now().toString(36).toUpperCase()}`
}

function receivableNumber() {
  return `CXC-${Date.now().toString(36).toUpperCase()}`
}

export async function GET(request: Request) {
  const access = await requirePermission(request, 'sales:read')
  if (access.response) return access.response
  const sales = await prisma.sale.findMany({
    include: {
      customer: { select: { name: true, document: true } },
      items: { include: { product: { select: { name: true, sku: true } } } },
      receivable: { select: { balance: true, paidAmount: true, status: true, originalAmount: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(sales.map((sale) => ({
    ...sale,
    taxRate: sale.taxRate.toString(),
    subtotal: sale.subtotal.toString(),
    taxAmount: sale.taxAmount.toString(),
    total: sale.total.toString(),
    receivable: sale.receivable ? {
      ...sale.receivable,
      balance: sale.receivable.balance.toString(),
      paidAmount: sale.receivable.paidAmount.toString(),
      originalAmount: sale.receivable.originalAmount.toString(),
    } : null,
    items: sale.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      unitCost: item.unitCost.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'sales:write')
  if (access.response) return access.response
  const payload = saleSchema.safeParse(await request.json())

  if (!payload.success) {
    return NextResponse.json({ error: 'Selecciona al menos un producto y revisa los datos de la venta.' }, { status: 400 })
  }

  const uniqueProductIds = new Set(payload.data.items.map((item) => item.productId))
  if (uniqueProductIds.size !== payload.data.items.length) {
    return NextResponse.json({ error: 'No repitas el mismo producto en una venta.' }, { status: 400 })
  }

  try {
    const sale = await prisma.$transaction(async (transaction) => {
      let cashAccountId = payload.data.cashAccountId
      if (payload.data.paymentMethod !== 'CREDIT' && !cashAccountId) {
        const defaultAccount = await transaction.cashAccount.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
        cashAccountId = defaultAccount?.id
        if (!cashAccountId) {
          const createdAccount = await transaction.cashAccount.create({ data: { name: 'Caja principal', type: 'CASH' } })
          cashAccountId = createdAccount.id
        }
      }

      if (payload.data.paymentMethod === 'CREDIT' && !payload.data.customerId) {
        throw new Error('CUSTOMER_REQUIRED')
      }

      if (cashAccountId) {
        const account = await transaction.cashAccount.findFirst({ where: { id: cashAccountId, isActive: true } })
        if (!account) throw new Error('CASH_ACCOUNT_NOT_FOUND')
      }

      const products = await transaction.product.findMany({
        where: { id: { in: payload.data.items.map((item) => item.productId) }, isActive: true },
      })

      if (products.length !== payload.data.items.length) {
        throw new Error('PRODUCT_NOT_FOUND')
      }

      const productById = new Map(products.map((product) => [product.id, product]))
      const lines = payload.data.items.map((item) => {
        const product = productById.get(item.productId)
        if (!product || product.currentStock < item.quantity) throw new Error('INSUFFICIENT_STOCK')

        const unitPrice = Number(product.price)
        return {
          product,
          quantity: item.quantity,
          unitPrice,
          unitCost: Number(product.cost),
          lineTotal: roundMoney(unitPrice * item.quantity),
        }
      })

      const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
      const taxAmount = roundMoney(subtotal * 0.13)
      const total = roundMoney(subtotal + taxAmount)
      const number = saleNumber()

      const createdSale = await transaction.sale.create({
        data: {
          number,
          customerId: payload.data.customerId,
          cashAccountId,
          paymentMethod: payload.data.paymentMethod,
          notes: payload.data.notes || undefined,
          taxRate: 13,
          subtotal,
          taxAmount,
          total,
          items: {
            create: lines.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              unitCost: line.unitCost,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { items: true },
      })

      for (const line of lines) {
        const updated = await transaction.product.updateMany({
          where: { id: line.product.id, currentStock: { gte: line.quantity } },
          data: { currentStock: { decrement: line.quantity } },
        })
        if (updated.count !== 1) throw new Error('INSUFFICIENT_STOCK')

        await transaction.inventoryMovement.create({
          data: {
            type: 'SALE',
            quantity: -line.quantity,
            unitCost: line.unitCost,
            reference: number,
            productId: line.product.id,
            saleId: createdSale.id,
          },
        })
      }

      if (payload.data.paymentMethod !== 'CREDIT' && cashAccountId) {
        await transaction.cashAccount.update({
          where: { id: cashAccountId },
          data: { balance: { increment: total } },
        })
        await transaction.cashMovement.create({
          data: {
            type: 'IN',
            amount: total,
            description: `Cobro de venta ${number}`,
            reference: number,
            accountId: cashAccountId,
            saleId: createdSale.id,
          },
        })
      }

      if (payload.data.paymentMethod === 'CREDIT' && payload.data.customerId) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 30)
        await transaction.accountReceivable.create({
          data: {
            number: receivableNumber(),
            originalAmount: total,
            balance: total,
            dueDate,
            customerId: payload.data.customerId,
            saleId: createdSale.id,
          },
        })
      }

      return createdSale
    })

    return NextResponse.json({ ...sale, subtotal: sale.subtotal.toString(), taxAmount: sale.taxAmount.toString(), total: sale.total.toString() }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'CUSTOMER_REQUIRED'
      ? 'Las ventas a crédito necesitan un cliente.'
      : error instanceof Error && error.message === 'CASH_ACCOUNT_REQUIRED'
      ? 'Selecciona una cuenta para registrar el cobro.'
      : error instanceof Error && error.message === 'CASH_ACCOUNT_NOT_FOUND'
        ? 'La cuenta seleccionada no existe o está inactiva.'
        : error instanceof Error && error.message === 'INSUFFICIENT_STOCK'
      ? 'Stock insuficiente para uno de los productos.'
      : error instanceof Error && error.message === 'PRODUCT_NOT_FOUND'
        ? 'Uno de los productos no existe o está inactivo.'
        : 'No se pudo registrar la venta.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
