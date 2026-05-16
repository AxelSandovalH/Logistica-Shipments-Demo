import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']),
  description: z.string().optional(),
  location: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
    include: { agency: true, origin: true, destination: true, events: { orderBy: { createdAt: 'asc' }, include: { createdBy: true } }, createdBy: true },
  })

  if (!shipment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (user.role !== 'ADMIN' && shipment.agencyId !== user.agencyId) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  return NextResponse.json({ shipment })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Solo administradores pueden eliminar envíos' }, { status: 403 })

  const shipment = await prisma.shipment.findUnique({ where: { id: params.id } })
  if (!shipment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.trackingEvent.deleteMany({ where: { shipmentId: params.id } })
  await prisma.shipment.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = UpdateStatusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const shipment = await prisma.shipment.findUnique({ where: { id: params.id } })
  if (!shipment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (user.role !== 'ADMIN' && shipment.agencyId !== user.agencyId) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const statusDescriptions: Record<string, string> = {
    RECEIVED: 'Paquete recibido en bodega',
    IN_TRANSIT: 'Paquete en tránsito',
    OUT_FOR_DELIVERY: 'Paquete en ruta de entrega',
    DELIVERED: 'Paquete entregado al destinatario',
    FAILED: 'Intento de entrega fallido',
    RETURNED: 'Paquete en proceso de devolución',
  }

  const [updated] = await Promise.all([
    prisma.shipment.update({
      where: { id: params.id },
      data: { status: parsed.data.status, deliveredAt: parsed.data.status === 'DELIVERED' ? new Date() : undefined },
    }),
    prisma.trackingEvent.create({
      data: {
        shipmentId: params.id, status: parsed.data.status,
        description: parsed.data.description ?? statusDescriptions[parsed.data.status],
        location: parsed.data.location, createdById: user.id,
      },
    }),
  ])

  return NextResponse.json({ shipment: updated })
}
