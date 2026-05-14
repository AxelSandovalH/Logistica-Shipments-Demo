import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/ultramsg'
import { generateGuideNumber } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STATUS_ES: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado ✓',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

// ── Herramientas ──────────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'listar_agencias',
    description: 'Lista las agencias disponibles. Úsalo cuando el admin necesite crear una guía y no tenga agencia asignada.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'consultar_envio',
    description: 'Busca un envío por número de guía o nombre del destinatario/remitente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Número de guía o nombre a buscar' },
      },
      required: ['query'],
    },
  },
  {
    name: 'listar_envios',
    description: 'Lista los envíos recientes, opcionalmente filtrados por estado o agencia.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status:    { type: 'string', description: 'Estado: RECEIVED, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED. Omitir para todos.' },
        agencyId:  { type: 'string', description: 'ID de agencia específica (solo admin). Omitir para todas.' },
      },
    },
  },
  {
    name: 'crear_guia',
    description: 'Crea una nueva guía de envío. Reúne todos los datos requeridos antes de llamar esta herramienta. Si el usuario es admin sin agencia, llama listar_agencias primero y pide que elija.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agencyId:      { type: 'string', description: 'ID de la agencia (requerido si el usuario es admin sin agencia asignada)' },
        senderName:    { type: 'string', description: 'Nombre del remitente' },
        senderPhone:   { type: 'string', description: 'Teléfono del remitente' },
        senderEmail:   { type: 'string', description: 'Email del remitente (opcional)' },
        recipientName: { type: 'string', description: 'Nombre del destinatario' },
        recipientPhone:{ type: 'string', description: 'Teléfono del destinatario' },
        destStreet:    { type: 'string', description: 'Calle y número del destino' },
        destCity:      { type: 'string', description: 'Ciudad del destino' },
        destState:     { type: 'string', description: 'Estado del destino en México' },
        destColonia:   { type: 'string', description: 'Colonia (opcional)' },
        destZip:       { type: 'string', description: 'Código postal (opcional)' },
        weight:        { type: 'number', description: 'Peso en kg (opcional)' },
        description:   { type: 'string', description: 'Descripción del contenido (opcional)' },
        serviceType:   { type: 'string', description: 'STANDARD, EXPRESS o ECONOMY. Default STANDARD.' },
        pieces:        { type: 'number', description: 'Número de piezas. Default 1.' },
      },
      required: ['senderName', 'recipientName', 'recipientPhone', 'destStreet', 'destCity', 'destState'],
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca un cliente en el directorio.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Nombre, teléfono o email' },
      },
      required: ['search'],
    },
  },
]

// ── Ejecutar herramienta ──────────────────────────────────────────────────────

async function runTool(
  name: string,
  input: any,
  userAgencyId: string | null,
): Promise<string> {

  if (name === 'listar_agencias') {
    const agencies = await prisma.agency.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    })
    if (!agencies.length) return 'No hay agencias activas registradas.'
    return agencies.map(a => `• *${a.name}* (${a.code}) — ID: \`${a.id}\``).join('\n')
  }

  if (name === 'consultar_envio') {
    const shipments = await prisma.shipment.findMany({
      where: {
        ...(userAgencyId ? { agencyId: userAgencyId } : {}),
        OR: [
          { guideNumber:   { contains: input.query, mode: 'insensitive' } },
          { recipientName: { contains: input.query, mode: 'insensitive' } },
          { senderName:    { contains: input.query, mode: 'insensitive' } },
        ],
      },
      include: { destination: true, agency: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    if (!shipments.length) return 'No se encontraron envíos.'
    return shipments.map(s =>
      `• *${s.guideNumber}* — ${s.recipientName} → ${s.destination?.city ?? '?'}, ${s.destination?.state ?? ''}\n  Estado: ${STATUS_ES[s.status] ?? s.status}${!userAgencyId ? `\n  Agencia: ${s.agency?.name}` : ''}`
    ).join('\n')
  }

  if (name === 'listar_envios') {
    const effectiveAgency = userAgencyId ?? input.agencyId ?? null
    const where: any = effectiveAgency ? { agencyId: effectiveAgency } : {}
    if (input.status) where.status = input.status
    const shipments = await prisma.shipment.findMany({
      where,
      include: { destination: true, agency: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    if (!shipments.length) return 'No hay envíos registrados.'
    return shipments.map(s =>
      `• *${s.guideNumber}* — ${s.recipientName} → ${s.destination?.city ?? '?'}\n  ${STATUS_ES[s.status] ?? s.status}${!userAgencyId ? ` | ${s.agency?.name}` : ''}`
    ).join('\n')
  }

  if (name === 'crear_guia') {
    // Determinar agencia: la del usuario o la que eligió el admin
    const resolvedAgencyId = userAgencyId ?? input.agencyId
    if (!resolvedAgencyId) {
      return 'Necesito saber a qué agencia pertenece este envío. Usa listar_agencias para ver las opciones y pídele al usuario que elija una.'
    }

    const agency = await prisma.agency.findUnique({ where: { id: resolvedAgencyId } })
    if (!agency) return 'Agencia no encontrada. Verifica el ID.'

    const guideNumber = generateGuideNumber(agency.code)
    const destination = await prisma.address.create({
      data: {
        street:  input.destStreet,
        colonia: input.destColonia ?? null,
        city:    input.destCity,
        state:   input.destState,
        zip:     input.destZip ?? '',
        country: 'MX',
      },
    })

    const shipment = await prisma.shipment.create({
      data: {
        guideNumber,
        status:         'RECEIVED',
        senderName:     input.senderName,
        senderPhone:    input.senderPhone ?? null,
        senderEmail:    input.senderEmail ?? null,
        recipientName:  input.recipientName,
        recipientPhone: input.recipientPhone ?? null,
        weight:         input.weight ?? null,
        description:    input.description ?? null,
        serviceType:    input.serviceType ?? 'STANDARD',
        pieces:         input.pieces ?? 1,
        agencyId:       resolvedAgencyId,
        destinationId:  destination.id,
      },
    })

    await prisma.trackingEvent.create({
      data: {
        shipmentId:  shipment.id,
        status:      'RECEIVED',
        description: 'Paquete recibido en bodega (vía WhatsApp)',
      },
    })

    return `✅ *Guía creada*\n\n📦 *${guideNumber}*\nAgencia: ${agency.name}\nRemitente: ${input.senderName}\nDestinatario: ${input.recipientName}\nDestino: ${input.destCity}, ${input.destState}\nServicio: ${input.serviceType ?? 'STANDARD'}\n\n🔗 Rastreo: https://hurryops.app/track/${guideNumber}\n🖨️ Imprimir guía: https://hurryops.app/print/${guideNumber}`
  }

  if (name === 'buscar_cliente') {
    const clients = await prisma.client.findMany({
      where: {
        ...(userAgencyId ? { agencyId: userAgencyId } : {}),
        OR: [
          { name:  { contains: input.search, mode: 'insensitive' } },
          { phone: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
        ],
      },
      include: { agency: true },
      take: 5,
    })
    if (!clients.length) return 'No se encontró ningún cliente.'
    return clients.map(c =>
      `• *${c.name}*${c.phone ? ' — ' + c.phone : ''}${c.city ? ', ' + c.city : ''}${!userAgencyId ? ` (${c.agency?.name})` : ''}`
    ).join('\n')
  }

  return 'Herramienta no reconocida.'
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const msg  = body.data
  if (!msg || msg.type !== 'chat') return NextResponse.json({ ok: true })

  const rawPhone = msg.from?.replace('@c.us', '').replace(/\D/g, '') ?? ''
  const text     = msg.body?.trim()
  if (!rawPhone || !text) return NextResponse.json({ ok: true })

  // Normalizar número mexicano (con/sin el "1" extra tras 52)
  const phonesToTry = Array.from(new Set([
    rawPhone,
    rawPhone.startsWith('521') ? '52' + rawPhone.slice(3) : null,
    rawPhone.startsWith('52') && !rawPhone.startsWith('521') ? '521' + rawPhone.slice(2) : null,
  ].filter(Boolean))) as string[]

  const user = await prisma.user.findFirst({
    where: { whatsappPhone: { in: phonesToTry }, active: true },
    include: { agency: true },
  })

  if (!user) {
    await sendWhatsapp(msg.from, '❌ Tu número no está vinculado a HurryOps. Contacta a tu administrador.')
    return NextResponse.json({ ok: true })
  }

  if (user.role !== 'ADMIN' && !user.agencyId) {
    await sendWhatsapp(msg.from, '❌ Tu usuario no tiene una agencia asignada. Contacta a tu administrador.')
    return NextResponse.json({ ok: true })
  }

  const userAgencyId = user.agencyId ?? null

  // Historial de conversación
  const session = await prisma.whatsappSession.upsert({
    where:  { phone: rawPhone },
    create: { phone: rawPhone, messages: [] },
    update: {},
  })

  const history: Anthropic.MessageParam[] = (session.messages as any[]) ?? []
  history.push({ role: 'user', content: text })
  const messages: Anthropic.MessageParam[] = history.slice(-20)

  const isAdmin  = user.role === 'ADMIN'
  const agencyLabel = user.agency?.name ?? 'HurryOps'

  // Loop de herramientas
  let finalText = ''
  while (true) {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `Eres el asistente de operaciones de *${agencyLabel}* en WhatsApp.
Rol del usuario: ${isAdmin ? 'Administrador (puede ver y crear en cualquier agencia)' : 'Usuario de agencia'}.
${isAdmin && !userAgencyId ? 'Al crear guías, primero lista las agencias con listar_agencias y pide al usuario que elija una.' : ''}
Ayudas a: crear guías, consultar envíos, listar envíos, buscar clientes.
Responde en español, conciso, formato WhatsApp (*negrita*).
Para crear guía necesitas: nombre remitente, nombre+teléfono destinatario, calle+ciudad+estado destino. Pide lo que falte.
No inventes datos.
Fecha: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      finalText = textBlock?.type === 'text' ? textBlock.text : ''
      messages.push({ role: 'assistant', content: response.content })
      break
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const result = await runTool(block.name, block.input, userAgencyId)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  // Guardar historial (solo mensajes de texto para ahorrar espacio)
  const toSave = messages.filter(m =>
    typeof m.content === 'string' ||
    (Array.isArray(m.content) && m.content.every((b: any) => b.type === 'text'))
  ).slice(-20)

  await prisma.whatsappSession.update({
    where: { phone: rawPhone },
    data:  { messages: toSave as any },
  })

  if (finalText) await sendWhatsapp(msg.from, finalText)
  return NextResponse.json({ ok: true })
}
