import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { generateGuideNumber } from '@/lib/utils'
import { sendGuideCreatedEmail } from '@/lib/email'
import { z } from 'zod'

// ── Shared sender + package fields ───────────────────────────────────────────
const SenderSchema = z.object({
  senderName:    z.string().min(1),
  senderPhone:   z.string().optional(),
  senderEmail:   z.string().email().optional().or(z.literal('')),
  weight:        z.coerce.number().positive().optional(),
  packageType:   z.enum(['PACKAGE', 'ENVELOPE', 'PALLET']).default('PACKAGE'),
  description:   z.string().optional(),
  pieces:        z.coerce.number().int().positive().default(1),
  declaredValue: z.coerce.number().positive().optional(),
  serviceType:   z.enum(['STANDARD', 'EXPRESS', 'ECONOMY']).default('STANDARD'),
  notes:         z.string().optional(),
  agencyId:      z.string().optional(),
  originStreet:  z.string().optional(),
  originColonia: z.string().optional(),
  originCity:    z.string().optional(),
  originState:   z.string().optional(),
  originZip:     z.string().optional(),
})

// ── Per-recipient fields ──────────────────────────────────────────────────────
const RecipientSchema = z.object({
  recipientName:   z.string().min(1),
  recipientPhone:  z.string().optional(),
  recipientEmail:  z.string().email().optional().or(z.literal('')),
  notifyRecipient: z.boolean().default(false),
  destStreet:      z.string().min(1),
  destColonia:     z.string().optional(),
  destCity:        z.string().min(1),
  destState:       z.string().min(1),
  destZip:         z.string().optional(),
  destReferences:  z.string().optional(),
})

// ── Multi-recipient (1→N) schema ──────────────────────────────────────────────
const BulkSchema = SenderSchema.extend({
  recipients: z.array(RecipientSchema).min(1),
})

// ── Single-recipient (legacy) schema ─────────────────────────────────────────
const CreateShipmentSchema = SenderSchema.merge(RecipientSchema)

// ── Helper: create one shipment + event + optional emails ────────────────────
async function createOne(
  sender: z.infer<typeof SenderSchema>,
  recipient: z.infer<typeof RecipientSchema>,
  agencyId: string,
  agencyCode: string,
  agencyName: string,
  userId: string,
  originId: string | null,
) {
  const guideNumber = generateGuideNumber(agencyCode)

  const destination = await prisma.address.create({
    data: {
      street: recipient.destStreet,
      colonia: recipient.destColonia,
      city: recipient.destCity,
      state: recipient.destState,
      zip: recipient.destZip ?? '',
      country: 'MX',
      references: recipient.destReferences,
    },
  })

  const shipment = await prisma.shipment.create({
    data: {
      guideNumber, status: 'RECEIVED',
      senderName:      sender.senderName,
      senderPhone:     sender.senderPhone,
      senderEmail:     sender.senderEmail || null,
      recipientName:   recipient.recipientName,
      recipientPhone:  recipient.recipientPhone,
      recipientEmail:  recipient.recipientEmail || null,
      weight:          sender.weight,
      packageType:     sender.packageType,
      description:     sender.description,
      pieces:          sender.pieces,
      declaredValue:   sender.declaredValue,
      serviceType:     sender.serviceType,
      notes:           sender.notes,
      notifyRecipient: recipient.notifyRecipient,
      agencyId, createdById: userId,
      originId:        originId ?? undefined,
      destinationId:   destination.id,
    },
  })

  await prisma.trackingEvent.create({
    data: { shipmentId: shipment.id, status: 'RECEIVED', description: 'Paquete recibido en bodega', createdById: userId },
  })

  // Email remitente
  if (sender.senderEmail) {
    sendGuideCreatedEmail({
      to: sender.senderEmail, guideNumber: shipment.guideNumber,
      senderName: sender.senderName, recipientName: recipient.recipientName,
      recipientPhone: recipient.recipientPhone, destCity: recipient.destCity,
      destState: recipient.destState, agencyName,
      weight: sender.weight, pieces: sender.pieces,
      description: sender.description, serviceType: sender.serviceType,
    }).catch(err => console.error('[email] guía creada (remitente):', err))
  }

  // Email destinatario
  if (recipient.notifyRecipient && recipient.recipientEmail && recipient.recipientEmail !== sender.senderEmail) {
    sendGuideCreatedEmail({
      to: recipient.recipientEmail, guideNumber: shipment.guideNumber,
      senderName: sender.senderName, recipientName: recipient.recipientName,
      recipientPhone: recipient.recipientPhone, destCity: recipient.destCity,
      destState: recipient.destState, agencyName,
      weight: sender.weight, pieces: sender.pieces,
      description: sender.description, serviceType: sender.serviceType,
    }).catch(err => console.error('[email] guía creada (destinatario):', err))
  }

  return shipment
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  // ── Detect multi-recipient mode ───────────────────────────────────────────
  if (Array.isArray(body.recipients)) {
    const parsed = BulkSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos. Verifica los campos obligatorios.' }, { status: 400 })

    const { recipients, ...senderData } = parsed.data
    const agencyId = user.role === 'ADMIN' ? (senderData.agencyId ?? user.agencyId!) : user.agencyId!

    const agency = await prisma.agency.findUnique({ where: { id: agencyId } })
    if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 400 })

    // Create shared origin address once (if provided)
    const origin = senderData.originCity
      ? await prisma.address.create({
          data: {
            street: senderData.originStreet ?? '',
            colonia: senderData.originColonia,
            city: senderData.originCity,
            state: senderData.originState ?? '',
            zip: senderData.originZip ?? '',
            country: 'US',
          },
        })
      : null

    // Create one shipment per recipient sequentially (to keep guide numbers ordered)
    const guideNumbers: string[] = []
    for (const recipient of recipients) {
      const s = await createOne(senderData, recipient, agencyId, agency.code, agency.name, user.id, origin?.id ?? null)
      guideNumbers.push(s.guideNumber)
    }

    return NextResponse.json({ guideNumbers }, { status: 201 })
  }

  // ── Single-recipient (legacy) mode ───────────────────────────────────────
  const parsed = CreateShipmentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos. Verifica los campos obligatorios.' }, { status: 400 })

  const data = parsed.data
  const agencyId = user.role === 'ADMIN' ? (data.agencyId ?? user.agencyId!) : user.agencyId!

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } })
  if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 400 })

  const origin = data.originCity
    ? await prisma.address.create({
        data: { street: data.originStreet ?? '', colonia: data.originColonia, city: data.originCity, state: data.originState ?? '', zip: data.originZip ?? '', country: 'US' },
      })
    : null

  const { recipientName, recipientPhone, recipientEmail, notifyRecipient,
          destStreet, destColonia, destCity, destState, destZip, destReferences,
          ...senderData } = data

  const shipment = await createOne(
    senderData,
    { recipientName, recipientPhone, recipientEmail, notifyRecipient,
      destStreet, destColonia, destCity, destState, destZip, destReferences },
    agencyId, agency.code, agency.name, user.id, origin?.id ?? null,
  )

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
