import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendStatusUpdateEmail } from '@/lib/email'
import { sendPushToDriver } from '@/lib/push'

const DESCRIPTIONS: Record<string, string> = {
  RECEIVED:         'Recibido en bodega EE.UU.',
  RECEIVED_MX:      'Confirmado en bodega México',
  IN_TRANSIT:       'Paquete en tránsito hacia México',
  OUT_FOR_DELIVERY: 'Paquete en ruta de entrega final',
  DELIVERED:        'Paquete entregado al destinatario',
  FAILED:           'Intento de entrega fallido',
  RETURNED:         'Paquete devuelto a origen',
}

// Flujo real: Bodega USA → tránsito → Bodega MX → chofer (asignado desde dashboard)
const BODEGA_TRANSITIONS: Record<string, string[]> = {
  RECEIVED:         ['IN_TRANSIT'],                   // Bodega USA: enviar a México
  IN_TRANSIT:       ['RECEIVED'],                     // Bodega MX: confirmar llegada
  FAILED:           ['OUT_FOR_DELIVERY', 'RETURNED'], // Reintento o devolución
}

export async function GET(_req: NextRequest, { params }: { params: { guide: string } }) {
  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    include: {
      agency: true,
      origin: true,
      destination: true,
      events: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { warehouse: { select: { name: true, city: true } } },
      },
    },
  })

  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  // Verificar si hay bodegas activas configuradas
  const warehouseCount = await prisma.warehouse.count({ where: { active: true } })

  return NextResponse.json({
    shipment,
    nextStatuses: BODEGA_TRANSITIONS[shipment.status] ?? [],
    requiresPin: warehouseCount > 0,
    agencyId: shipment.agencyId,
  })
}

export async function POST(req: NextRequest, { params }: { params: { guide: string } }) {
  const { status, location, description, pin, photoUrl } = await req.json()

  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    include: { agency: true, destination: true },
  })

  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  // Validar PIN y obtener bodega
  let warehouseId: string | null = null
  let warehouseCity: string | null = null
  if (pin) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { pin, active: true },
      select: { id: true, city: true },
    })
    if (!warehouse) {
      return NextResponse.json({ error: 'PIN de bodega incorrecto', requiresPin: true }, { status: 401 })
    }
    warehouseId = warehouse.id
    warehouseCity = warehouse.city
  } else {
    const warehouseCount = await prisma.warehouse.count({ where: { active: true } })
    if (warehouseCount > 0) {
      return NextResponse.json({ error: 'PIN de bodega requerido', requiresPin: true }, { status: 401 })
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
        shipmentId:  shipment.id,
        status,
        description: description || (shipment.status === 'IN_TRANSIT' && status === 'RECEIVED'
          ? DESCRIPTIONS['RECEIVED_MX']
          : DESCRIPTIONS[status]),
        location:    location || null,
        warehouseId: warehouseId,
        photoUrl:    photoUrl || null,
      },
    }),
  ])

  // Push al chofer asignado cuando el paquete sale de bodega hacia él
  if (status === 'OUT_FOR_DELIVERY' && shipment.assignedDriverId) {
    const driver = await prisma.user.findUnique({
      where:  { id: shipment.assignedDriverId },
      select: { pushSubscription: true },
    })
    if (driver?.pushSubscription) {
      sendPushToDriver(driver.pushSubscription, {
        title: '🚚 Paquete listo para entregar',
        body:  `Guía ${shipment.guideNumber} · ${shipment.recipientName} ya está en tu ruta`,
        url:   '/driver',
        tag:   'ready',
      }).catch(async (err) => {
        if (err?.statusCode === 410) {
          await prisma.user.update({ where: { id: shipment.assignedDriverId! }, data: { pushSubscription: undefined } })
        }
      })
    }
  }

  // Correo al remitente siempre (si tiene email)
  if (shipment.senderEmail) {
    sendStatusUpdateEmail({
      to:            shipment.senderEmail,
      guideNumber:   shipment.guideNumber,
      recipientName: shipment.recipientName,
      status,
      agencyName:    shipment.agency?.name ?? 'HurryOps',
      warehouseCity,
      location:      location || null,
    }).catch(err => console.error('[email] status update (remitente):', err))
  }

  // Correo al destinatario solo si fue autorizado al crear la guía
  if (shipment.notifyRecipient && shipment.recipientEmail && shipment.recipientEmail !== shipment.senderEmail) {
    sendStatusUpdateEmail({
      to:            shipment.recipientEmail,
      guideNumber:   shipment.guideNumber,
      recipientName: shipment.recipientName,
      status,
      agencyName:    shipment.agency?.name ?? 'HurryOps',
      warehouseCity,
      location:      location || null,
    }).catch(err => console.error('[email] status update (destinatario):', err))
  }

  return NextResponse.json({ ok: true, status })
}
