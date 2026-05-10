import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Descripciones automáticas por estado
const DESCRIPTIONS: Record<string, string> = {
  RECEIVED:         'Paquete recibido en bodega',
  IN_TRANSIT:       'Paquete en tránsito hacia destino',
  OUT_FOR_DELIVERY: 'Paquete en ruta de entrega final',
  DELIVERED:        'Paquete entregado al destinatario',
  FAILED:           'Intento de entrega fallido',
  RETURNED:         'Paquete devuelto a origen',
}

// Transiciones permitidas desde bodega (recibir y despachar)
const BODEGA_TRANSITIONS: Record<string, string[]> = {
  RECEIVED:   ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'RECEIVED'],
  FAILED:     ['IN_TRANSIT', 'RETURNED'],
}

export async function GET(_req: NextRequest, { params }: { params: { guide: string } }) {
  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    include: {
      agency: true,
      origin: true,
      destination: true,
      events: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  return NextResponse.json({
    shipment,
    nextStatuses: BODEGA_TRANSITIONS[shipment.status] ?? [],
  })
}

export async function POST(req: NextRequest, { params }: { params: { guide: string } }) {
  const { status, location, description } = await req.json()

  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
  })

  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  const allowed = BODEGA_TRANSITIONS[shipment.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Transición de estado no permitida' }, { status: 400 })
  }

  const [updated] = await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
      },
    }),
    prisma.trackingEvent.create({
      data: {
        shipmentId: shipment.id,
        status,
        description: description || DESCRIPTIONS[status],
        location: location || null,
      },
    }),
  ])

  return NextResponse.json({ ok: true, status: updated.status })
}
