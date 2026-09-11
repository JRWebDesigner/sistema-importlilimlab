import { NextResponse } from 'next/server'

import { getSession } from '@/lib/auth'

type Role = 'ADMIN' | 'SALES' | 'INVENTORY' | 'ACCOUNTING' | 'VIEWER'
export type Permission = 'sales:read' | 'sales:write' | 'inventory:read' | 'inventory:write' | 'finance:read' | 'finance:write' | 'contacts:read' | 'contacts:write' | 'users:manage'

const permissions: Record<Role, Permission[]> = {
  ADMIN: ['sales:read', 'sales:write', 'inventory:read', 'inventory:write', 'finance:read', 'finance:write', 'contacts:read', 'contacts:write', 'users:manage'],
  SALES: ['sales:read', 'sales:write', 'inventory:read', 'contacts:read', 'contacts:write'],
  INVENTORY: ['inventory:read', 'inventory:write', 'contacts:read'],
  ACCOUNTING: ['sales:read', 'inventory:read', 'finance:read', 'finance:write', 'contacts:read'],
  VIEWER: ['sales:read', 'inventory:read', 'finance:read', 'contacts:read'],
}

export async function requirePermission(request: Request, permission: Permission) {
  const session = await getSession(request)
  if (!session) return { session: null, response: NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 }) }
  const role = session.role as Role
  if (!permissions[role]?.includes(permission)) return { session: null, response: NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 }) }
  return { session, response: null }
}

export async function requireAnyPermission(request: Request, required: Permission[]) {
  const session = await getSession(request)
  if (!session) return { session: null, response: NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 }) }
  const role = session.role as Role
  if (!required.some((permission) => permissions[role]?.includes(permission))) return { session: null, response: NextResponse.json({ error: 'No tienes permiso para ver el dashboard.' }, { status: 403 }) }
  return { session, response: null }
}

export function rolePermissions(role: string) {
  return permissions[role as Role] ?? []
}
