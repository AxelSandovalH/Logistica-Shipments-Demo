import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value
  if (token) {
    await prisma.clientSession.deleteMany({ where: { token } }).catch(() => {})
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('portal_session', '', { expires: new Date(0), path: '/' })
  return res
}
