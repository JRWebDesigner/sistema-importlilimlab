import { NextResponse } from 'next/server'
import { z } from 'zod'

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
    where: query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { document: { contains: query, mode: 'insensitive' } }] } : undefined,
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
