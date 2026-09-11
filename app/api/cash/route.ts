import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const accountSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['CASH', 'BANK', 'POS']),
  initialBalance: z.coerce.number().finite().min(0).default(0),
})

const movementSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(['IN', 'OUT']),
  amount: z.coerce.number().finite().positive(),
  description: z.string().trim().min(1).max(250),
})

function serializeAccount(account: { balance: { toString(): string }; [key: string]: unknown }) {
  return { ...account, balance: account.balance.toString() }
}

export async function GET(request: Request) {
  const access = await requirePermission(request, 'finance:read')
  if (access.response) return access.response
  const accounts = await prisma.cashAccount.findMany({
    where: { isActive: true },
    include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(accounts.map((account) => ({
    ...serializeAccount(account),
    movements: account.movements.map((movement) => ({ ...movement, amount: movement.amount.toString() })),
  })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'finance:write')
  if (access.response) return access.response
  const body = await request.json()
  const accountPayload = accountSchema.safeParse(body)

  if (accountPayload.success) {
    try {
      const account = await prisma.$transaction(async (transaction) => {
        const created = await transaction.cashAccount.create({
          data: {
            name: accountPayload.data.name,
            type: accountPayload.data.type,
            balance: accountPayload.data.initialBalance,
          },
        })
        if (accountPayload.data.initialBalance > 0) {
          await transaction.cashMovement.create({
            data: {
              type: 'IN',
              amount: accountPayload.data.initialBalance,
              description: 'Saldo inicial',
              reference: 'SALDO-INICIAL',
              accountId: created.id,
            },
          })
        }
        return created
      })
      return NextResponse.json(serializeAccount(account), { status: 201 })
    } catch {
      return NextResponse.json({ error: 'No se pudo crear la cuenta.' }, { status: 400 })
    }
  }

  const movementPayload = movementSchema.safeParse(body)
  if (!movementPayload.success) {
    return NextResponse.json({ error: 'Revisa los datos de la cuenta o movimiento.' }, { status: 400 })
  }

  try {
    const account = await prisma.$transaction(async (transaction) => {
      const current = await transaction.cashAccount.findFirst({ where: { id: movementPayload.data.accountId, isActive: true } })
      if (!current) throw new Error('ACCOUNT_NOT_FOUND')
      const signedAmount = movementPayload.data.type === 'IN' ? movementPayload.data.amount : -movementPayload.data.amount
      if (signedAmount < 0 && Number(current.balance) < movementPayload.data.amount) throw new Error('INSUFFICIENT_BALANCE')

      await transaction.cashAccount.update({ where: { id: current.id }, data: { balance: { increment: signedAmount } } })
      await transaction.cashMovement.create({
        data: {
          type: movementPayload.data.type,
          amount: movementPayload.data.amount,
          description: movementPayload.data.description,
          reference: 'AJUSTE-CAJA',
          accountId: current.id,
        },
      })
      return transaction.cashAccount.findUniqueOrThrow({ where: { id: current.id } })
    })
    return NextResponse.json(serializeAccount(account), { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'INSUFFICIENT_BALANCE'
      ? 'El retiro supera el saldo disponible.'
      : error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND'
        ? 'La cuenta no existe o está inactiva.'
        : 'No se pudo registrar el movimiento.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const session = await getSession(request)
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo el administrador puede eliminar cuentas bancarias.' }, { status: 403 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? (await request.clone().json().catch(() => ({}))).id

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Falta el identificador de la cuenta.' }, { status: 400 })
  }

  try {
    const account = await prisma.cashAccount.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } })
    if (!account) return NextResponse.json({ error: 'La cuenta no existe.' }, { status: 404 })

    await prisma.cashAccount.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ ok: true, id, name: account.name })
  } catch {
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta.' }, { status: 400 })
  }
}
