import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'nexo_session'

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error('AUTH_SECRET no está configurado')
  return new TextEncoder().encode(value)
}

export async function createSessionToken(userId: string, role: string) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret())
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify(token, secret())
  return { userId: result.payload.sub, role: result.payload.role }
}

export async function getSession(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.split('=')[1]
  if (!token) return null
  try {
    return await verifySessionToken(token)
  } catch {
    return null
  }
}
