import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const purchaseSchema = z.object({
  supplierId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'QR', 'CREDIT']),
  cashAccountId: z.string().min(1).optional(),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().positive(), unitCost: z.coerce.number().finite().positive() })).min(1),
})

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const numberFor = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}`

export async function GET(request: Request) {
  const access = await requirePermission(request, 'finance:read')
  if (access.response) return access.response
  const purchases = await prisma.purchase.findMany({ include: { supplier: { select: { name: true, document: true } }, items: { include: { product: { select: { name: true, sku: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json(purchases.map((purchase) => ({ ...purchase, subtotal: purchase.subtotal.toString(), taxAmount: purchase.taxAmount.toString(), total: purchase.total.toString(), items: purchase.items.map((item) => ({ ...item, unitCost: item.unitCost.toString(), lineTotal: item.lineTotal.toString() })) })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'finance:write')
  if (access.response) return access.response
  const payload = purchaseSchema.safeParse(await request.json())
  if (!payload.success) return NextResponse.json({ error: 'Revisa proveedor, productos y costos.' }, { status: 400 })
  if (new Set(payload.data.items.map((item) => item.productId)).size !== payload.data.items.length) return NextResponse.json({ error: 'No repitas productos en una compra.' }, { status: 400 })

  try {
    const purchase = await prisma.$transaction(async (transaction) => {
      if (payload.data.paymentMethod !== 'CREDIT' && !payload.data.cashAccountId) throw new Error('ACCOUNT_REQUIRED')
      const supplier = await transaction.supplier.findFirst({ where: { id: payload.data.supplierId, isActive: true } })
      if (!supplier) throw new Error('SUPPLIER_NOT_FOUND')
      if (payload.data.paymentMethod !== 'CREDIT') {
        const account = await transaction.cashAccount.findFirst({ where: { id: payload.data.cashAccountId, isActive: true } })
        if (!account) throw new Error('ACCOUNT_NOT_FOUND')
      }
      const products = await transaction.product.findMany({ where: { id: { in: payload.data.items.map((item) => item.productId) }, isActive: true } })
      if (products.length !== payload.data.items.length) throw new Error('PRODUCT_NOT_FOUND')
      const productById = new Map(products.map((product) => [product.id, product]))
      const lines = payload.data.items.map((item) => ({ ...item, product: productById.get(item.productId)!, lineTotal: roundMoney(item.quantity * item.unitCost) }))
      const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
      const taxAmount = roundMoney(subtotal * 0.13)
      const total = roundMoney(subtotal + taxAmount)
      const number = numberFor('C')
      const created = await transaction.purchase.create({ data: { number, supplierId: supplier.id, paymentMethod: payload.data.paymentMethod, cashAccountId: payload.data.cashAccountId, subtotal, taxAmount, total, items: { create: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, unitCost: line.unitCost, lineTotal: line.lineTotal })) } }, include: { items: true } })

      for (const line of lines) {
        await transaction.product.update({ where: { id: line.product.id }, data: { currentStock: { increment: line.quantity }, cost: line.unitCost } })
        await transaction.inventoryMovement.create({ data: { type: 'PURCHASE', quantity: line.quantity, unitCost: line.unitCost, reference: number, productId: line.product.id, purchaseId: created.id } })
      }
      if (payload.data.paymentMethod === 'CREDIT') {
        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30)
        await transaction.accountPayable.create({ data: { number: numberFor('CXP'), originalAmount: total, balance: total, dueDate, supplierId: supplier.id, purchaseId: created.id } })
      } else if (payload.data.cashAccountId) {
        await transaction.cashAccount.update({ where: { id: payload.data.cashAccountId }, data: { balance: { decrement: total } } })
        await transaction.cashMovement.create({ data: { type: 'OUT', amount: total, description: `Pago de compra ${number}`, reference: number, accountId: payload.data.cashAccountId } })
      }
      return created
    })
    return NextResponse.json({ ...purchase, subtotal: purchase.subtotal.toString(), taxAmount: purchase.taxAmount.toString(), total: purchase.total.toString() }, { status: 201 })
  } catch (error) {
    const messages: Record<string, string> = { ACCOUNT_REQUIRED: 'Selecciona una cuenta para pagar la compra.', ACCOUNT_NOT_FOUND: 'La cuenta no existe o está inactiva.', SUPPLIER_NOT_FOUND: 'El proveedor no existe o está inactivo.', PRODUCT_NOT_FOUND: 'Uno de los productos no existe o está inactivo.' }
    return NextResponse.json({ error: error instanceof Error ? messages[error.message] ?? 'No se pudo registrar la compra.' : 'No se pudo registrar la compra.' }, { status: 400 })
  }
}
