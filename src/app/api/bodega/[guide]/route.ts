import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DESCRIPTIONS: Record<string, string> = {
  RECEIVED:         'Paquete recibido en bodega',
  IN_TRANSIT:       'Paquete en tránsito hacia destino',
  OUT_FOR_DELIVERY: 'Paquete en ruta de entrega final',
  DELIVERED:        'Paquete entregado al destinatario',
  FAILED:           'Intento de entrega fallido',
  RETURNED:         'Paquete devuelto a origen',
}

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
    requiresPin: !!shipment.agency?.warehousePin,
    agencyId: shipment.agencyId,
  })
}

export async function POST(req: NextRequest, { params }: { params: { guide: string } }) {
  const { status, location, description, pin } = await req.json()

  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    include: { agency: true },
  })

  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  // Validar PIN si la agencia lo tiene configurado
  if (shipment.agency?.warehousePin) {
    if (!pin) return NextResponse.json({ error: 'PIN requerido', requiresPin: true }, { status: 401 })
    if (pin !== shipment.agency.warehousePin) {
      return NextResponse.json({ error: 'PIN incorrecto', requiresPin: true }, { status: 401 })
    }
  }

  const allowed = BODEGA_TRANSITIONS[shipment.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Transición de estado no permitida' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipment.id },
      data: { status },
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

  return NextResponse.json({ ok: true, status })
}
