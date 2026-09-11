import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSession } from '@/lib/auth'
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

export async function DELETE(request: Request) {
  const session = await getSession(request)
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el administrador puede eliminar categorías.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? (await request.clone().json().catch(() => ({}))).id

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Falta el identificador de la categoría.' }, { status: 400 })
  }

  try {
    const category = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } })
    if (!category) return NextResponse.json({ error: 'La categoría no existe.' }, { status: 404 })

    await prisma.category.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ ok: true, id, name: category.name })
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la categoría.' }, { status: 400 })
  }
}
