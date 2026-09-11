import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const supplierSchema = z.object({
  document: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(180),
  email: z.union([z.string().email().max(180), z.literal('')]).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(250).optional(),
})

export async function GET(request: Request) {
  const access = await requirePermission(request, 'contacts:read')
  if (access.response) return access.response
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: true,
      ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { document: { contains: query, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(suppliers)
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'contacts:write')
  if (access.response) return access.response
  const payload = supplierSchema.safeParse(await request.json())
  if (!payload.success) return NextResponse.json({ error: 'Revisa los datos del proveedor.' }, { status: 400 })
  try {
    return NextResponse.json(await prisma.supplier.create({ data: payload.data }), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.includes('Unique constraint') ? 'El NIT ya está registrado.' : 'No se pudo guardar el proveedor.' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession(request)
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el administrador puede eliminar proveedores.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? (await request.clone().json().catch(() => ({}))).id

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Falta el identificador del proveedor.' }, { status: 400 })
  }

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } })
    if (!supplier) return NextResponse.json({ error: 'El proveedor no existe.' }, { status: 404 })

    await prisma.supplier.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ ok: true, id, name: supplier.name })
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar el proveedor.' }, { status: 400 })
  }
}
