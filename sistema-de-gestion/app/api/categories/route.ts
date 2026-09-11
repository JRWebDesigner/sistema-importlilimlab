import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export async function GET(request: Request) {
  const access = await requirePermission(request, 'inventory:read')
  if (access.response) return access.response
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(categories)
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'inventory:write')
  if (access.response) return access.response
  const payload = categorySchema.safeParse(await request.json())

  if (!payload.success) {
    return NextResponse.json({ error: 'El nombre de la categoría es obligatorio.' }, { status: 400 })
  }

  try {
    const category = await prisma.category.create({ data: payload.data })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message.includes('Unique constraint')
      ? 'La categoría ya existe.'
      : 'No se pudo guardar la categoría.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
