import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const productSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(180),
  categoryId: z.string().min(1),
  cost: z.coerce.number().finite().min(0),
  price: z.coerce.number().finite().positive(),
  currentStock: z.coerce.number().int().min(0),
  minimumStock: z.coerce.number().int().min(0),
})

export async function GET(request: Request) {
  const access = await requirePermission(request, 'inventory:read')
  if (access.response) return access.response
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { sku: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    products.map((product) => ({
      ...product,
      cost: product.cost.toString(),
      price: product.price.toString(),
    })),
  )
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'inventory:write')
  if (access.response) return access.response
  const payload = productSchema.safeParse(await request.json())

  if (!payload.success) {
    return NextResponse.json({ error: 'Revisa los datos del producto.' }, { status: 400 })
  }

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const createdProduct = await transaction.product.create({
        data: payload.data,
      })

      if (createdProduct.currentStock > 0) {
        await transaction.inventoryMovement.create({
          data: {
            type: 'INITIAL',
            quantity: createdProduct.currentStock,
            unitCost: createdProduct.cost,
            productId: createdProduct.id,
            reference: 'STOCK-INICIAL',
          },
        })
      }

      await logAudit({
        request,
        action: 'CREATE',
        moduleName: 'Inventario',
        entity: 'Product',
        entityId: createdProduct.id,
        details: `Se registró el producto ${createdProduct.name} con stock inicial ${createdProduct.currentStock}.`,
      })

      return transaction.product.findUniqueOrThrow({
        where: { id: createdProduct.id },
        include: { category: true },
      })
    })

    return NextResponse.json(
      {
        ...product,
        cost: product.cost.toString(),
        price: product.price.toString(),
      },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error && error.message.includes('Unique constraint')
      ? 'El SKU ya existe.'
      : error instanceof Error && error.message.includes('Foreign key constraint')
        ? 'La categoría seleccionada no existe.'
        : 'No se pudo guardar el producto.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession(request)
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el administrador puede eliminar productos.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? (await request.clone().json().catch(() => ({}))).id

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Falta el identificador del producto.' }, { status: 400 })
  }

  try {
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } })
    if (!product) return NextResponse.json({ error: 'El producto no existe.' }, { status: 404 })

    await prisma.product.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ ok: true, id, name: product.name })
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el producto.' }, { status: 400 })
  }
}
