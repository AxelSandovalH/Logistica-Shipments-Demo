import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { email, code } = await req.json()
  const lower = email?.toLowerCase().trim()
  if (!lower || !code) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const otp = await prisma.clientOtp.findFirst({
    where: { email: lower },
    orderBy: { createdAt: 'desc' },
  })

  if (!otp || otp.code !== code) {
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
  }
  if (otp.expiry < new Date()) {
    await prisma.clientOtp.delete({ where: { id: otp.id } })
    return NextResponse.json({ error: 'Código expirado, solicita uno nuevo' }, { status: 410 })
  }

  // Crear sesión
  const token  = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días

  await Promise.all([
    prisma.clientSession.create({ data: { email: lower, token, expiry } }),
    prisma.clientOtp.delete({ where: { id: otp.id } }),
  ])

  const res = NextResponse.json({ ok: true })
  res.cookies.set('portal_session', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires:  expiry,
    path:     '/',
  })
  return res
}
