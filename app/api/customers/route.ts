import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

const customerSchema = z.object({
  type: z.enum(['PERSON', 'COMPANY']),
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
  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { document: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(customers)
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'contacts:write')
  if (access.response) return access.response
  const payload = customerSchema.safeParse(await request.json())

  if (!payload.success) {
    return NextResponse.json({ error: 'Revisa los datos del cliente.' }, { status: 400 })
  }

  try {
    const customer = await prisma.customer.create({ data: payload.data })
    await logAudit({
      request,
      action: 'CREATE',
      moduleName: 'Clientes',
      entity: 'Customer',
      entityId: customer.id,
      details: `Se agregó el cliente ${customer.name} (${customer.document}).`,
    })
    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message.includes('Unique constraint')
      ? 'El documento ya está registrado.'
      : 'No se pudo guardar el cliente.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
