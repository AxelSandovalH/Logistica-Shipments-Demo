import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { sendStatusUpdateEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'DRIVER') return NextResponse.json({ error: 'Solo choferes' }, { status: 403 })

  const { shipmentId, status, note, photoUrl } = await req.json()
  if (!shipmentId || !status) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  if (!['DELIVERED', 'FAILED'].includes(status)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { agency: true },
  })
  if (!shipment) return NextResponse.json({ error: 'Envío no encontrado' }, { status: 404 })
  if (shipment.assignedDriverId !== user.id) return NextResponse.json({ error: 'No asignado a ti' }, { status: 403 })

  const DESCRIPTIONS: Record<string, string> = {
    DELIVERED: 'Paquete entregado al destinatario',
    FAILED:    'Intento de entrega fallido',
  }

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      },
    }),
    prisma.trackingEvent.create({
      data: {
        shipmentId,
        status,
        description: note || DESCRIPTIONS[status],
        createdById: user.id,
        photoUrl:    photoUrl || null,
      },
    }),
  ])

  // Emails
  if (shipment.senderEmail) {
    sendStatusUpdateEmail({
      to: shipment.senderEmail, guideNumber: shipment.guideNumber,
      recipientName: shipment.recipientName, status,
      agencyName: shipment.agency?.name ?? 'HurryOps',
    }).catch(console.error)
  }
  if (shipment.notifyRecipient && shipment.recipientEmail) {
    sendStatusUpdateEmail({
      to: shipment.recipientEmail, guideNumber: shipment.guideNumber,
      recipientName: shipment.recipientName, status,
      agencyName: shipment.agency?.name ?? 'HurryOps',
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
