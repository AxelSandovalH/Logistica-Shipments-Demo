import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getSessionEmail(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('portal_session')?.value
  if (!token) return null
  const session = await prisma.clientSession.findUnique({ where: { token } })
  if (!session || session.expiry < new Date()) return null
  return session.email
}

export async function GET(req: NextRequest) {
  const email = await getSessionEmail(req)
  if (!email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const shipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { recipientEmail: email },
        { senderEmail:    email },
      ],
    },
    include: {
      destination: true,
      agency:      { select: { name: true } },
      events:      { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ shipments, email })
}
