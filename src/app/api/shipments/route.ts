import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { generateGuideNumber } from '@/lib/utils'
import { sendGuideCreatedEmail } from '@/lib/email'
import { z } from 'zod'

const CreateShipmentSchema = z.object({
  senderName: z.string().min(1),
  senderPhone: z.string().optional(),
  senderEmail: z.string().email().optional().or(z.literal('')),
  recipientName: z.string().min(1),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  notifyRecipient: z.boolean().default(false),
  weight: z.coerce.number().positive().optional(),
  packageType: z.enum(['PACKAGE', 'ENVELOPE', 'PALLET']).default('PACKAGE'),
  description: z.string().optional(),
  pieces: z.coerce.number().int().positive().default(1),
  declaredValue: z.coerce.number().positive().optional(),
  serviceType: z.enum(['STANDARD', 'EXPRESS', 'ECONOMY']).default('STANDARD'),
  notes: z.string().optional(),
  agencyId: z.string().optional(),
  originStreet: z.string().optional(),
  originColonia: z.string().optional(),
  originCity: z.string().optional(),
  originState: z.string().optional(),
  originZip: z.string().optional(),
  destStreet: z.string().min(1),
  destColonia: z.string().optional(),
  destCity: z.string().min(1),
  destState: z.string().min(1),
  destZip: z.string().optional(),
  destReferences: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateShipmentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const agencyId = user.role === 'ADMIN' ? (data.agencyId ?? user.agencyId!) : user.agencyId!

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } })
  if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 400 })

  const guideNumber = generateGuideNumber(agency.code)

  const [origin, destination] = await Promise.all([
    data.originCity
      ? prisma.address.create({
          data: { street: data.originStreet ?? '', colonia: data.originColonia, city: data.originCity, state: data.originState ?? '', zip: data.originZip ?? '', country: 'US' },
        })
      : Promise.resolve(null),
    prisma.address.create({
      data: { street: data.destStreet, colonia: data.destColonia, city: data.destCity, state: data.destState, zip: data.destZip ?? '', country: 'MX', references: data.destReferences },
    }),
  ])

  const shipment = await prisma.shipment.create({
    data: {
      guideNumber, status: 'RECEIVED',
      senderName: data.senderName, senderPhone: data.senderPhone, senderEmail: data.senderEmail || null,
      recipientName: data.recipientName, recipientPhone: data.recipientPhone, recipientEmail: data.recipientEmail || null,
      weight: data.weight, packageType: data.packageType, description: data.description,
      pieces: data.pieces, declaredValue: data.declaredValue, serviceType: data.serviceType, notes: data.notes,
      notifyRecipient: data.notifyRecipient,
      agencyId, createdById: user.id,
      originId: origin?.id, destinationId: destination.id,
    },
  })

  await prisma.trackingEvent.create({
    data: { shipmentId: shipment.id, status: 'RECEIVED', description: 'Paquete recibido en bodega', createdById: user.id },
  })

  // Correo al remitente siempre (si tiene email)
  if (data.senderEmail) {
    sendGuideCreatedEmail({
      to:             data.senderEmail,
      guideNumber:    shipment.guideNumber,
      senderName:     data.senderName,
      recipientName:  data.recipientName,
      recipientPhone: data.recipientPhone,
      destCity:       data.destCity,
      destState:      data.destState,
      agencyName:     agency.name,
      weight:         data.weight,
      pieces:         data.pieces,
      description:    data.description,
      serviceType:    data.serviceType,
    }).catch(err => console.error('[email] guía creada (remitente):', err))
  }

  // Correo al destinatario solo si se solicitó y tiene email
  if (data.notifyRecipient && data.recipientEmail && data.recipientEmail !== data.senderEmail) {
    sendGuideCreatedEmail({
      to:             data.recipientEmail,
      guideNumber:    shipment.guideNumber,
      senderName:     data.senderName,
      recipientName:  data.recipientName,
      recipientPhone: data.recipientPhone,
      destCity:       data.destCity,
      destState:      data.destState,
      agencyName:     agency.name,
      weight:         data.weight,
      pieces:         data.pieces,
      description:    data.description,
      serviceType:    data.serviceType,
    }).catch(err => console.error('[email] guía creada (destinatario):', err))
  }

  return NextResponse.json({ shipment }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = Number(searchParams.get('page') ?? 1)
  const limit = 20

  const where: any = user.role === 'ADMIN' ? {} : { agencyId: user.agencyId }
  if (status) where.status = status
  if (search) where.OR = [
    { guideNumber: { contains: search, mode: 'insensitive' } },
    { recipientName: { contains: search, mode: 'insensitive' } },
    { senderName: { contains: search, mode: 'insensitive' } },
  ]

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({ where, include: { agency: true, destination: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.shipment.count({ where }),
  ])

  return NextResponse.json({ shipments, total, page, pages: Math.ceil(total / limit) })
}
