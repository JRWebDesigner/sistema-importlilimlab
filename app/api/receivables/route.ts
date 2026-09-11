import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const paymentSchema = z.object({
  receivableId: z.string().min(1),
  cashAccountId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'QR']),
  amount: z.coerce.number().finite().positive(),
})

export async function GET(request: Request) {
  const access = await requirePermission(request, 'finance:read')
  if (access.response) return access.response
  const receivables = await prisma.accountReceivable.findMany({
    include: {
      customer: { select: { name: true, document: true } },
      sale: { select: { number: true } },
      payments: true,
    },
    orderBy: { dueDate: 'asc' },
  })
  const now = new Date()

  return NextResponse.json(receivables.map((receivable) => ({
    ...receivable,
    status: receivable.status === 'PENDING' && receivable.dueDate < now ? 'OVERDUE' : receivable.status,
    originalAmount: receivable.originalAmount.toString(),
    paidAmount: receivable.paidAmount.toString(),
    balance: receivable.balance.toString(),
    payments: receivable.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })),
  })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'finance:write')
  if (access.response) return access.response
  const payload = paymentSchema.safeParse(await request.json())
  if (!payload.success) return NextResponse.json({ error: 'Revisa los datos del pago.' }, { status: 400 })

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const receivable = await transaction.accountReceivable.findUnique({ where: { id: payload.data.receivableId } })
      if (!receivable || receivable.status === 'PAID') throw new Error('RECEIVABLE_NOT_FOUND')
      if (payload.data.amount > Number(receivable.balance)) throw new Error('PAYMENT_TOO_LARGE')

      const account = await transaction.cashAccount.findFirst({ where: { id: payload.data.cashAccountId, isActive: true } })
      if (!account) throw new Error('ACCOUNT_NOT_FOUND')

      const nextBalance = Math.round((Number(receivable.balance) - payload.data.amount + Number.EPSILON) * 100) / 100
      const nextPaid = Math.round((Number(receivable.paidAmount) + payload.data.amount + Number.EPSILON) * 100) / 100
      const nextStatus = nextBalance === 0 ? 'PAID' : 'PARTIAL'
      const reference = `P-${Date.now().toString(36).toUpperCase()}`

      await transaction.accountReceivable.update({
        where: { id: receivable.id },
        data: { balance: nextBalance, paidAmount: nextPaid, status: nextStatus },
      })
      await transaction.receivablePayment.create({
        data: {
          amount: payload.data.amount,
          paymentMethod: payload.data.paymentMethod,
          reference,
          receivableId: receivable.id,
          cashAccountId: account.id,
        },
      })
      await transaction.cashAccount.update({ where: { id: account.id }, data: { balance: { increment: payload.data.amount } } })
      await transaction.cashMovement.create({
        data: {
          type: 'IN',
          amount: payload.data.amount,
          description: `Cobro de cuenta ${receivable.number}`,
          reference,
          accountId: account.id,
        },
      })

      return { reference, balance: nextBalance, status: nextStatus }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'PAYMENT_TOO_LARGE'
      ? 'El pago supera el saldo pendiente.'
      : error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND'
        ? 'La cuenta de cobro no existe o está inactiva.'
        : error instanceof Error && error.message === 'RECEIVABLE_NOT_FOUND'
          ? 'La cuenta por cobrar no existe o ya está pagada.'
          : 'No se pudo registrar el pago.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
