import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPortalOtpEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  }

  const lower = email.toLowerCase().trim()

  // Verificar que el email existe como remitente o destinatario en algún envío
  const hasShipments = await prisma.shipment.findFirst({
    where: {
      OR: [
        { senderEmail:    lower },
        { recipientEmail: lower },
      ],
    },
    select: { id: true },
  })

  if (!hasShipments) {
    return NextResponse.json({ error: 'No encontramos envíos asociados a ese correo' }, { status: 404 })
  }

  // Generar OTP de 6 dígitos
  const code   = String(Math.floor(100000 + Math.random() * 900000))
  const expiry = new Date(Date.now() + 15 * 60 * 1000)

  // Limpiar OTPs anteriores del mismo email
  await prisma.clientOtp.deleteMany({ where: { email: lower } })
  await prisma.clientOtp.create({ data: { email: lower, code, expiry } })

  await sendPortalOtpEmail({ to: lower, code }).catch(console.error)

  return NextResponse.json({ ok: true })
}
