import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const movementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT']),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
})

export async function GET(request: Request) {
  const access = await requirePermission(request, 'inventory:read')
  if (access.response) return access.response
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const products = await prisma.product.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { sku: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      category: true,
      inventoryMovements: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: [{ currentStock: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(products.map((product) => ({
    ...product,
    cost: product.cost.toString(),
    price: product.price.toString(),
    inventoryMovements: product.inventoryMovements.map((movement) => ({
      ...movement,
      unitCost: movement.unitCost?.toString() ?? null,
    })),
  })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'inventory:write')
  if (access.response) return access.response
  const payload = movementSchema.safeParse(await request.json())

  if (!payload.success) {
    return NextResponse.json({ error: 'Revisa el producto, tipo y cantidad del movimiento.' }, { status: 400 })
  }

  const isIncrease = payload.data.type === 'ADJUSTMENT_IN' || payload.data.type === 'RETURN_IN'
  const quantity = isIncrease ? payload.data.quantity : -payload.data.quantity

  try {
    const movement = await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({ where: { id: payload.data.productId } })
      if (!product || !product.isActive) throw new Error('PRODUCT_NOT_FOUND')

      const updated = await transaction.product.updateMany({
        where: {
          id: product.id,
          ...(quantity < 0 ? { currentStock: { gte: Math.abs(quantity) } } : {}),
        },
        data: { currentStock: { increment: quantity } },
      })
      if (updated.count !== 1) throw new Error('INSUFFICIENT_STOCK')

      return transaction.inventoryMovement.create({
        data: {
          type: payload.data.type,
          quantity,
          unitCost: product.cost,
          reference: 'AJUSTE-INVENTARIO',
          notes: payload.data.notes,
          productId: product.id,
        },
        include: { product: { select: { name: true, sku: true, currentStock: true } } },
      })
    })

    return NextResponse.json({ ...movement, unitCost: movement.unitCost?.toString() ?? null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'INSUFFICIENT_STOCK'
      ? 'El ajuste dejaría el stock en negativo.'
      : error instanceof Error && error.message === 'PRODUCT_NOT_FOUND'
        ? 'El producto no existe o está inactivo.'
        : 'No se pudo registrar el movimiento.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
