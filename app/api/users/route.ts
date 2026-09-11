import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  alias: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email().max(180),
  password: z.string().min(8).max(100),
  role: z.enum(['ADMIN', 'SALES', 'INVENTORY', 'ACCOUNTING', 'VIEWER']),
})

const updateSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['ADMIN', 'SALES', 'INVENTORY', 'ACCOUNTING', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
})

async function adminOnly(request: Request) {
  const session = await getSession(request)
  return session?.role === 'ADMIN' ? session : null
}

export async function GET(request: Request) {
  if (!await adminOnly(request)) return NextResponse.json({ error: 'Solo un administrador puede ver los usuarios.' }, { status: 403 })
  const users = await prisma.user.findMany({ select: { id: true, name: true, alias: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  if (!await adminOnly(request)) return NextResponse.json({ error: 'Solo un administrador puede crear usuarios.' }, { status: 403 })
  const payload = userSchema.safeParse(await request.json())
  if (!payload.success) return NextResponse.json({ error: 'Revisa nombre, correo, contraseña y rol.' }, { status: 400 })
  try {
    const passwordHash = await bcrypt.hash(payload.data.password, 12)
    const user = await prisma.user.create({ data: { name: payload.data.name, alias: payload.data.alias.toLowerCase(), email: payload.data.email.toLowerCase(), passwordHash, role: payload.data.role }, select: { id: true, name: true, alias: true, email: true, role: true, isActive: true, createdAt: true } })
    await logAudit({
      request,
      userId: session?.userId,
      userName: session ? (await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? 'Administrador' : 'Administrador',
      userEmail: session ? (await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } }))?.email ?? null : null,
      action: 'CREATE',
      moduleName: 'Usuarios',
      entity: 'User',
      entityId: user.id,
      details: `Se creó el usuario ${user.name} (${user.email}) con rol ${user.role}.`,
    })
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.includes('Unique constraint') ? 'El correo o alias ya está registrado.' : 'No se pudo crear el usuario.' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  const session = await adminOnly(request)
  if (!session) return NextResponse.json({ error: 'Solo un administrador puede modificar usuarios.' }, { status: 403 })
  const payload = updateSchema.safeParse(await request.json())
  if (!payload.success) return NextResponse.json({ error: 'Datos de usuario inválidos.' }, { status: 400 })
  if (payload.data.id === session.userId && payload.data.isActive === false) return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta.' }, { status: 400 })
  const previousUser = await prisma.user.findUnique({ where: { id: payload.data.id }, select: { id: true, name: true, email: true, role: true, isActive: true } })
  const user = await prisma.user.update({ where: { id: payload.data.id }, data: { role: payload.data.role, isActive: payload.data.isActive }, select: { id: true, name: true, alias: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } })
  await logAudit({
    request,
    userId: session.userId,
    userName: session.role === 'ADMIN' ? 'Administrador' : 'Sistema',
    userEmail: null,
    action: 'UPDATE',
    moduleName: 'Usuarios',
    entity: 'User',
    entityId: user.id,
    details: `Se actualizó el usuario ${user.name}. Rol: ${previousUser?.role ?? 'N/A'} -> ${user.role}. Estado: ${previousUser?.isActive ? 'Activo' : 'Inactivo'} -> ${user.isActive ? 'Activo' : 'Inactivo'}.`,
  })
  return NextResponse.json(user)
}
