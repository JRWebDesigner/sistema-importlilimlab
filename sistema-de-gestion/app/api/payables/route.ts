import { NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

const paymentSchema = z.object({
  payableId: z.string().min(1),
  cashAccountId: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'QR']),
  amount: z.coerce.number().finite().positive(),
})

export async function GET(request: Request) {
  const access = await requirePermission(request, 'finance:read')
  if (access.response) return access.response
  const payables = await prisma.accountPayable.findMany({ include: { supplier: { select: { name: true, document: true } }, purchase: { select: { number: true } }, payments: true }, orderBy: { dueDate: 'asc' } })
  const now = new Date()
  return NextResponse.json(payables.map((payable) => ({ ...payable, status: payable.status === 'PENDING' && payable.dueDate < now ? 'OVERDUE' : payable.status, originalAmount: payable.originalAmount.toString(), paidAmount: payable.paidAmount.toString(), balance: payable.balance.toString(), payments: payable.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })) })))
}

export async function POST(request: Request) {
  const access = await requirePermission(request, 'finance:write')
  if (access.response) return access.response
  const payload = paymentSchema.safeParse(await request.json())
  if (!payload.success) return NextResponse.json({ error: 'Revisa los datos del pago.' }, { status: 400 })
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const payable = await transaction.accountPayable.findUnique({ where: { id: payload.data.payableId } })
      if (!payable || payable.status === 'PAID') throw new Error('PAYABLE_NOT_FOUND')
      if (payload.data.amount > Number(payable.balance)) throw new Error('PAYMENT_TOO_LARGE')
      const account = await transaction.cashAccount.findFirst({ where: { id: payload.data.cashAccountId, isActive: true } })
      if (!account) throw new Error('ACCOUNT_NOT_FOUND')
      if (Number(account.balance) < payload.data.amount) throw new Error('INSUFFICIENT_BALANCE')
      const balance = Math.round((Number(payable.balance) - payload.data.amount + Number.EPSILON) * 100) / 100
      const paid = Math.round((Number(payable.paidAmount) + payload.data.amount + Number.EPSILON) * 100) / 100
      const status = balance === 0 ? 'PAID' : 'PARTIAL'
      const reference = `PP-${Date.now().toString(36).toUpperCase()}`
      await transaction.accountPayable.update({ where: { id: payable.id }, data: { balance, paidAmount: paid, status } })
      await transaction.payablePayment.create({ data: { amount: payload.data.amount, paymentMethod: payload.data.paymentMethod, reference, payableId: payable.id, cashAccountId: account.id } })
      await transaction.cashAccount.update({ where: { id: account.id }, data: { balance: { decrement: payload.data.amount } } })
      await transaction.cashMovement.create({ data: { type: 'OUT', amount: payload.data.amount, description: `Pago a proveedor ${payable.number}`, reference, accountId: account.id } })
      return { reference, balance, status }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const messages: Record<string, string> = { PAYABLE_NOT_FOUND: 'La cuenta por pagar no existe o ya está pagada.', PAYMENT_TOO_LARGE: 'El pago supera el saldo pendiente.', ACCOUNT_NOT_FOUND: 'La cuenta no existe o está inactiva.', INSUFFICIENT_BALANCE: 'El saldo de caja es insuficiente.' }
    return NextResponse.json({ error: error instanceof Error ? messages[error.message] ?? 'No se pudo registrar el pago.' : 'No se pudo registrar el pago.' }, { status: 400 })
  }
}
