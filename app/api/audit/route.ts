import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/permissions'

export async function GET(request: Request) {
  const access = await requirePermission(request, 'users:manage')
  if (access.response) return access.response

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json(logs.map((log) => ({
    ...log,
    oldValue: log.oldValue ?? null,
    newValue: log.newValue ?? null,
  })))
}
