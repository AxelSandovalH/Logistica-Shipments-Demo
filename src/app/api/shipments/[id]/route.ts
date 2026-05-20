import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']),
  description: z.string().optional(),
  location: z.string().optional(),
})

const AssignDriverSchema = z.object({
  _assign: z.literal(true),
  assignedDriverId: z.string().nullable(),
})

const EditShipmentSchema = z.object({
  _edit: z.literal(true),
  senderName:     z.string().min(1).optional(),
  senderPhone:    z.string().optional(),
  senderEmail:    z.string().email().optional().or(z.literal('')),
  recipientName:  z.string().min(1).optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  notifyRecipient: z.boolean().optional(),
  weight:         z.coerce.number().positive().optional().nullable(),
  pieces:         z.coerce.number().int().positive().optional(),
  packageType:    z.enum(['PACKAGE', 'ENVELOPE', 'PALLET']).optional(),
  serviceType:    z.enum(['STANDARD', 'EXPRESS', 'ECONOMY']).optional(),
  description:    z.string().optional(),
  declaredValue:  z.coerce.number().positive().optional().nullable(),
  notes:          z.string().optional(),
  // dirección destino
  destStreet:     z.string().optional(),
  destColonia:    z.string().optional(),
  destCity:       z.string().optional(),
  destState:      z.string().optional(),
  destZip:        z.string().optional(),
  destReferences: z.string().optional(),
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

  // Rama asignación de chofer
  if (body._assign) {
    const parsed = AssignDriverSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    if (user.role !== 'ADMIN' && user.role !== 'AGENCY') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { events: { select: { status: true } } },
    })
    if (!shipment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (user.role !== 'ADMIN' && shipment.agencyId !== user.agencyId) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    // Auto-cambio a OUT_FOR_DELIVERY solo si el envío ya pasó por bodega
    // (tuvo al menos un evento IN_TRANSIT = pasó de USA a MX y está listo para repartir)
    const wentThroughTransit = shipment.events.some(e => e.status === 'IN_TRANSIT')
    const shouldUpdateStatus =
      parsed.data.assignedDriverId !== null &&
      wentThroughTransit &&
      !['DELIVERED', 'RETURNED', 'OUT_FOR_DELIVERY'].includes(shipment.status)

    const updated = await prisma.shipment.update({
      where: { id: params.id },
      data: {
        assignedDriverId: parsed.data.assignedDriverId,
        ...(shouldUpdateStatus && { status: 'OUT_FOR_DELIVERY' }),
      },
    })

    if (shouldUpdateStatus) {
      await prisma.trackingEvent.create({
        data: {
          shipmentId: params.id,
          status: 'OUT_FOR_DELIVERY',
          description: 'Paquete asignado a chofer y en ruta de entrega',
          createdById: user.id,
        },
      })
    }

    return NextResponse.json({ shipment: updated })
  }

  // Rama edición de datos
  if (body._edit) {
    const parsed = EditShipmentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    const shipment = await prisma.shipment.findUnique({
      where: { id: params.id },
      include: { destination: true },
    })
    if (!shipment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (user.role !== 'ADMIN' && shipment.agencyId !== user.agencyId)
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const { _edit, destStreet, destColonia, destCity, destState, destZip, destReferences, ...shipmentFields } = parsed.data

    // Actualizar dirección destino si se envió algún campo
    if (shipment.destinationId && (destStreet || destColonia || destCity || destState || destZip || destReferences !== undefined)) {
      await prisma.address.update({
        where: { id: shipment.destinationId },
        data: {
          ...(destStreet     !== undefined && { street: destStreet }),
          ...(destColonia    !== undefined && { colonia: destColonia }),
          ...(destCity       !== undefined && { city: destCity }),
          ...(destState      !== undefined && { state: destState }),
          ...(destZip        !== undefined && { zip: destZip }),
          ...(destReferences !== undefined && { references: destReferences }),
        },
      })
    }

    const updated = await prisma.shipment.update({
      where: { id: params.id },
      data: {
        ...shipmentFields,
        senderEmail:    shipmentFields.senderEmail    || null,
        recipientEmail: shipmentFields.recipientEmail || null,
      },
      include: { agency: true, origin: true, destination: true, events: { orderBy: { createdAt: 'asc' }, include: { createdBy: true } }, createdBy: true },
    })
    return NextResponse.json({ shipment: updated })
  }

  // Rama cambio de estado
  const parsed = UpdateStatusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

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
