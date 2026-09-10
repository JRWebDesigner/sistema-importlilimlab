import { NextRequest, NextResponse } from 'next/server'

import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/_next') || pathname.includes('.')) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      await verifySessionToken(token)
      return NextResponse.next()
    } catch {
      // Continue to the login redirect below.
    }
  }

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sesión requerida.' }, { status: 401 })
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
