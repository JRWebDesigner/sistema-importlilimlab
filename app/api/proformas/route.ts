import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const proformaItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
})

const proformaSchema = z.object({
  customerId: z.string().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(proformaItemSchema).min(1),
})

const acceptSchema = z.object({
  proformaId: z.string().min(1),
  action: z.enum(['accept', 'reject']),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'QR', 'CREDIT']).optional(),
  cashAccountId: z.string().min(1).optional(),
})

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

function proformaNumber() {
  return `PF-${Date.now().toString(36).toUpperCase()}`
}

function saleNumber() {
  return `V-${Date.now().toString(36).toUpperCase()}`
}

function receivableNumber() {
  return `CXC-${Date.now().toString(36).toUpperCase()}`
}

export async function GET(request: Request) {
  const access = await requirePermission(request, 'sales:read')
  if (access.response) return access.response

  const proformas = await prisma.proforma.findMany({
    include: {
      customer: { select: { id: true, name: true, document: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(proformas.map((proforma) => ({
    ...proforma,
    taxRate: proforma.taxRate.toString(),
    subtotal: proforma.subtotal.toString(),
    taxAmount: proforma.taxAmount.toString(),
    total: proforma.total.toString(),
    items: proforma.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
  })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'sales:write')
  if (access.response) return access.response

  const payload = proformaSchema.safeParse(await request.json())
  if (!payload.success) {
    return NextResponse.json({ error: 'Revisa los productos y los datos de la proforma.' }, { status: 400 })
  }

  const uniqueProductIds = new Set(payload.data.items.map((item) => item.productId))
  if (uniqueProductIds.size !== payload.data.items.length) {
    return NextResponse.json({ error: 'No repitas el mismo producto en una proforma.' }, { status: 400 })
  }

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: payload.data.items.map((item) => item.productId) }, isActive: true },
    })

    if (products.length !== payload.data.items.length) {
      throw new Error('PRODUCT_NOT_FOUND')
    }

    const productById = new Map(products.map((product) => [product.id, product]))
    const lines = payload.data.items.map((item) => {
      const product = productById.get(item.productId)
      if (!product) throw new Error('PRODUCT_NOT_FOUND')

      const unitPrice = Number(product.price)
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        lineTotal: roundMoney(unitPrice * item.quantity),
      }
    })

    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
    const taxAmount = roundMoney(subtotal * 0.13)
    const total = roundMoney(subtotal + taxAmount)

    const created = await prisma.proforma.create({
      data: {
        number: proformaNumber(),
        customerId: payload.data.customerId,
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
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true, document: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    })

    await logAudit({
      request,
      action: 'CREATE',
      moduleName: 'Proformas',
      entity: 'Proforma',
      entityId: created.id,
      details: `Se creó la proforma ${created.number} para ${created.customer?.name ?? 'cliente sin nombre'} por ${Number(created.total).toFixed(2)}.`,
    })

    return NextResponse.json({
      ...created,
      taxRate: created.taxRate.toString(),
      subtotal: created.subtotal.toString(),
      taxAmount: created.taxAmount.toString(),
      total: created.total.toString(),
      items: created.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
        lineTotal: item.lineTotal.toString(),
      })),
    }, { status: 201 })
  } catch (error) {
    console.error('ERROR_CREATING_PROFORMA', error)

    const message = error instanceof Error && error.message === 'PRODUCT_NOT_FOUND'
      ? 'Uno de los productos ya no está disponible.'
      : 'No se pudo guardar la proforma.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const access = await requirePermission(request, 'sales:write')
  if (access.response) return access.response

  const payload = acceptSchema.safeParse(await request.json())
  if (!payload.success) {
    return NextResponse.json({ error: 'Revisa la acción de la proforma.' }, { status: 400 })
  }

  const { action, proformaId, paymentMethod, cashAccountId } = payload.data

  try {
    const proforma = await prisma.proforma.findUnique({
      where: { id: proformaId },
      include: {
        customer: { select: { id: true, name: true, document: true } },
        items: { include: { product: true } },
      },
    })

    if (!proforma) {
      return NextResponse.json({ error: 'La proforma no existe.' }, { status: 404 })
    }

    if (action === 'reject') {
      const rejected = await prisma.proforma.update({
        where: { id: proformaId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
        },
      })

      await logAudit({
        request,
        action: 'REJECT',
        moduleName: 'Proformas',
        entity: 'Proforma',
        entityId: proformaId,
        details: `Se rechazó la proforma ${proforma.number}.`,
      })

      return NextResponse.json({ ...rejected, status: 'REJECTED' })
    }

    if (proforma.status !== 'SENT') {
      return NextResponse.json({ error: 'La proforma ya fue procesada.' }, { status: 400 })
    }

    const selectedPaymentMethod = paymentMethod ?? 'CASH'
    let selectedCashAccountId = cashAccountId

    if (selectedPaymentMethod !== 'CREDIT' && !selectedCashAccountId) {
      const defaultAccount = await prisma.cashAccount.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } })
      selectedCashAccountId = defaultAccount?.id
      if (!selectedCashAccountId) {
        const createdAccount = await prisma.cashAccount.create({ data: { name: 'Caja principal', type: 'CASH' } })
        selectedCashAccountId = createdAccount.id
      }
    }

    if (selectedPaymentMethod === 'CREDIT' && !proforma.customerId) {
      return NextResponse.json({ error: 'La proforma a crédito necesita un cliente.' }, { status: 400 })
    }

    const sale = await prisma.$transaction(async (transaction) => {
      if (selectedPaymentMethod !== 'CREDIT' && selectedCashAccountId) {
        const account = await transaction.cashAccount.findFirst({ where: { id: selectedCashAccountId, isActive: true } })
        if (!account) throw new Error('CASH_ACCOUNT_NOT_FOUND')
      }

      const lines = proforma.items.map((item) => {
        const product = item.product
        if (product.currentStock < item.quantity) throw new Error('INSUFFICIENT_STOCK')

        return {
          product,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          unitCost: Number(product.cost),
          lineTotal: roundMoney(Number(item.unitPrice) * item.quantity),
        }
      })

      const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
      const taxAmount = roundMoney(subtotal * 0.13)
      const total = roundMoney(subtotal + taxAmount)
      const createdSale = await transaction.sale.create({
        data: {
          number: saleNumber(),
          customerId: proforma.customerId || undefined,
          cashAccountId: selectedPaymentMethod === 'CREDIT' ? undefined : selectedCashAccountId || undefined,
          paymentMethod: selectedPaymentMethod,
          notes: proforma.notes ? `${proforma.notes} · Aceptada desde proforma` : 'Aceptada desde proforma',
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
        await transaction.product.update({
          where: { id: line.product.id },
          data: { currentStock: { decrement: line.quantity } },
        })

        await transaction.inventoryMovement.create({
          data: {
            type: 'SALE',
            quantity: -line.quantity,
            unitCost: line.unitCost,
            reference: createdSale.number,
            productId: line.product.id,
            saleId: createdSale.id,
          },
        })
      }

      if (selectedPaymentMethod !== 'CREDIT' && selectedCashAccountId) {
        await transaction.cashAccount.update({
          where: { id: selectedCashAccountId },
          data: { balance: { increment: total } },
        })

        await transaction.cashMovement.create({
          data: {
            type: 'IN',
            amount: total,
            description: `Venta convertida desde proforma ${proforma.number}`,
            reference: createdSale.number,
            accountId: selectedCashAccountId,
            saleId: createdSale.id,
          },
        })
      }

      if (selectedPaymentMethod === 'CREDIT' && proforma.customerId) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 30)

        await transaction.accountReceivable.create({
          data: {
            number: receivableNumber(),
            originalAmount: total,
            balance: total,
            dueDate,
            customerId: proforma.customerId,
            saleId: createdSale.id,
          },
        })
      }

      await transaction.proforma.update({
        where: { id: proformaId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          paymentMethod: selectedPaymentMethod,
        },
      })

      await logAudit({
        request,
        action: 'ACCEPT',
        moduleName: 'Proformas',
        entity: 'Proforma',
        entityId: proformaId,
        details: `Se aceptó la proforma ${proforma.number} y se convirtió en venta ${createdSale.number}.`,
      })

      return createdSale
    })

    return NextResponse.json({ sale, status: 'ACCEPTED' })
  } catch (error) {
    const message = error instanceof Error && error.message === 'CASH_ACCOUNT_NOT_FOUND'
      ? 'La cuenta seleccionada no existe o está inactiva.'
      : error instanceof Error && error.message === 'INSUFFICIENT_STOCK'
        ? 'No hay suficiente stock para aceptar la proforma.'
        : 'No se pudo aceptar la proforma.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
