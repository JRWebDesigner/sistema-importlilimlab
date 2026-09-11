import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/permissions'

const money = (value: number | { toString(): string }) => Number(value.toString()).toFixed(2)

export async function GET(request: Request) {
  const access = await requireAnyPermission(request, ['sales:read', 'inventory:read', 'finance:read'])
  if (access.response) return access.response

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const [sales, previousSales, products, accounts, receivables, payables, movements] = await Promise.all([
    prisma.sale.findMany({ where: { status: 'COMPLETED', createdAt: { gte: startOfYear } }, include: { items: true }, orderBy: { createdAt: 'desc' } }),
    prisma.sale.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: startOfPreviousMonth, lt: startOfMonth } }, _sum: { total: true } }),
    prisma.product.findMany({ where: { isActive: true }, include: { category: true }, orderBy: { currentStock: 'asc' } }),
    prisma.cashAccount.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.accountReceivable.findMany({ where: { status: { in: ['PENDING', 'PARTIAL'] } } }),
    prisma.accountPayable.findMany({ where: { status: { in: ['PENDING', 'PARTIAL'] } } }),
    prisma.inventoryMovement.findMany({ include: { product: { select: { name: true, sku: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
  ])

  const monthSales = sales.filter((sale) => sale.createdAt >= startOfMonth)
  const currentSalesTotal = monthSales.reduce((sum, sale) => sum + Number(sale.total), 0)
  const currentProfit = monthSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.lineTotal) - Number(item.unitCost) * item.quantity, 0), 0)
  const previousTotal = Number(previousSales._sum.total ?? 0)
  const change = previousTotal === 0 ? 0 : ((currentSalesTotal - previousTotal) / previousTotal) * 100
  const inventoryValue = products.reduce((sum, product) => sum + Number(product.cost) * product.currentStock, 0)
  const receivableTotal = receivables.reduce((sum, item) => sum + Number(item.balance), 0)
  const payableTotal = payables.reduce((sum, item) => sum + Number(item.balance), 0)
  const chart = Array.from({ length: 12 }, (_, index) => ({ month: new Date(now.getFullYear(), index, 1).toLocaleDateString('es-BO', { month: 'short' }).replace('.', ''), value: sales.filter((sale) => sale.createdAt.getMonth() === index).reduce((sum, sale) => sum + Number(sale.total), 0) }))

  return NextResponse.json({
    kpis: { sales: money(currentSalesTotal), profit: money(currentProfit), receivables: money(receivableTotal), inventory: money(inventoryValue), salesChange: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, payables: money(payableTotal) },
    chart,
    accounts: accounts.map((account) => ({ name: account.name, type: account.type, balance: money(account.balance) })),
    lowStock: products.filter((product) => product.currentStock <= product.minimumStock).slice(0, 6).map((product) => ({ name: product.name, sku: product.sku, category: product.category.name, stock: product.currentStock, price: money(product.price) })),
    movements: movements.map((movement) => ({ type: movement.type, product: movement.product.name, sku: movement.product.sku, quantity: movement.quantity, time: movement.createdAt.toISOString() })),
  })
}
