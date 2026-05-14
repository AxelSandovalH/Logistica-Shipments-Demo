import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/ultramsg'
import { generateGuideNumber } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Herramientas que Claude puede usar ───────────────────────────────────────

const tools: Anthropic.Tool[] = [
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
    description: 'Lista los envíos recientes de la agencia, opcionalmente filtrados por estado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Estado a filtrar: RECEIVED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED. Omitir para todos.' },
      },
    },
  },
  {
    name: 'crear_guia',
    description: 'Crea una nueva guía de envío. Solicita al usuario los datos que falten antes de llamar esta herramienta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        senderName:    { type: 'string', description: 'Nombre del remitente' },
        senderPhone:   { type: 'string', description: 'Teléfono del remitente' },
        senderEmail:   { type: 'string', description: 'Email del remitente (opcional)' },
        recipientName: { type: 'string', description: 'Nombre del destinatario' },
        recipientPhone:{ type: 'string', description: 'Teléfono del destinatario' },
        destStreet:    { type: 'string', description: 'Calle y número del destino' },
        destCity:      { type: 'string', description: 'Ciudad del destino' },
        destState:     { type: 'string', description: 'Estado del destino en México' },
        destColonia:   { type: 'string', description: 'Colonia del destino (opcional)' },
        destZip:       { type: 'string', description: 'Código postal del destino (opcional)' },
        weight:        { type: 'number', description: 'Peso en kilogramos (opcional)' },
        description:   { type: 'string', description: 'Descripción del contenido (opcional)' },
        serviceType:   { type: 'string', description: 'Tipo de servicio: STANDARD, EXPRESS, ECONOMY. Default STANDARD.' },
        pieces:        { type: 'number', description: 'Número de piezas. Default 1.' },
      },
      required: ['senderName', 'recipientName', 'recipientPhone', 'destStreet', 'destCity', 'destState'],
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca un cliente en el directorio de la agencia.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Nombre, teléfono o email a buscar' },
      },
      required: ['search'],
    },
  },
]

// ── Ejecutar herramienta ─────────────────────────────────────────────────────

async function runTool(name: string, input: any, agencyId: string | null): Promise<string> {
  if (name === 'consultar_envio') {
    const { query } = input
    const shipments = await prisma.shipment.findMany({
      where: {
        ...(agencyId ? { agencyId } : {}),
        OR: [
          { guideNumber: { contains: query, mode: 'insensitive' } },
          { recipientName: { contains: query, mode: 'insensitive' } },
          { senderName: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: { destination: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    if (!shipments.length) return 'No se encontraron envíos con esa búsqueda.'
    return shipments.map(s =>
      `• *${s.guideNumber}* — ${s.recipientName} → ${s.destination?.city ?? '?'}, ${s.destination?.state ?? ''}\n  Estado: ${STATUS_ES[s.status] ?? s.status}`
    ).join('\n')
  }

  if (name === 'listar_envios') {
    const where: any = agencyId ? { agencyId } : {}
    if (input.status) where.status = input.status
    const shipments = await prisma.shipment.findMany({
      where,
      include: { destination: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    if (!shipments.length) return 'No hay envíos registrados.'
    return shipments.map(s =>
      `• *${s.guideNumber}* — ${s.recipientName} → ${s.destination?.city ?? '?'}\n  ${STATUS_ES[s.status] ?? s.status}`
    ).join('\n')
  }

  if (name === 'crear_guia') {
    if (!agencyId) return 'Como administrador sin agencia asignada, no puedo crear guías desde WhatsApp. Usa el dashboard.'
    const agency = await prisma.agency.findUnique({ where: { id: agencyId } })
    if (!agency) return 'Error: agencia no encontrada.'

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
        status:        'RECEIVED',
        senderName:    input.senderName,
        senderPhone:   input.senderPhone ?? null,
        senderEmail:   input.senderEmail ?? null,
        recipientName: input.recipientName,
        recipientPhone:input.recipientPhone ?? null,
        weight:        input.weight ?? null,
        description:   input.description ?? null,
        serviceType:   input.serviceType ?? 'STANDARD',
        pieces:        input.pieces ?? 1,
        agencyId,
        destinationId: destination.id,
      },
    })

    await prisma.trackingEvent.create({
      data: { shipmentId: shipment.id, status: 'RECEIVED', description: 'Paquete recibido en bodega (vía WhatsApp)' },
    })

    return `✅ Guía creada exitosamente\n\n*${guideNumber}*\n\nRemitente: ${input.senderName}\nDestinatario: ${input.recipientName} — ${input.destCity}, ${input.destState}\nServicio: ${input.serviceType ?? 'STANDARD'}\n\nTracking: https://hurryops.app/tracking/${guideNumber}`
  }

  if (name === 'buscar_cliente') {
    const clients = await prisma.client.findMany({
      where: {
        ...(agencyId ? { agencyId } : {}),
        OR: [
          { name:  { contains: input.search, mode: 'insensitive' } },
          { phone: { contains: input.search, mode: 'insensitive' } },
          { email: { contains: input.search, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    if (!clients.length) return 'No se encontró ningún cliente con esa búsqueda.'
    return clients.map(c =>
      `• *${c.name}*${c.phone ? ' — ' + c.phone : ''}${c.city ? ' — ' + c.city : ''}`
    ).join('\n')
  }

  return 'Herramienta no reconocida.'
}

const STATUS_ES: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado ✓',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

// ── Webhook principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Ultramsg manda los datos en body.data
  const msg = body.data
  if (!msg || msg.type !== 'chat') return NextResponse.json({ ok: true })

  const rawPhone = msg.from?.replace('@c.us', '').replace(/\D/g, '') ?? ''
  const text     = msg.body?.trim()
  if (!rawPhone || !text) return NextResponse.json({ ok: true })

  // México: WhatsApp a veces agrega un "1" tras el 52 → normalizar ambos formatos
  const phonesToTry = Array.from(new Set([
    rawPhone,
    rawPhone.startsWith('521') ? '52' + rawPhone.slice(3) : rawPhone,
    rawPhone.startsWith('52') && !rawPhone.startsWith('521') ? '521' + rawPhone.slice(2) : rawPhone,
  ]))

  const user = await prisma.user.findFirst({
    where: { whatsappPhone: { in: phonesToTry }, active: true },
    include: { agency: true },
  })

  if (!user) {
    await sendWhatsapp(msg.from, '❌ Tu número no está vinculado a HurryOps. Contacta a tu administrador.')
    return NextResponse.json({ ok: true })
  }

  // ADMIN puede operar sin agencia; agencia regular necesita agencyId
  if (user.role !== 'ADMIN' && !user.agencyId) {
    await sendWhatsapp(msg.from, '❌ Tu usuario no tiene una agencia asignada. Contacta a tu administrador.')
    return NextResponse.json({ ok: true })
  }

  // Para ADMIN sin agencyId usamos null (las tools muestran todos los datos)
  const agencyId = user.agencyId ?? null

  // Recuperar o crear sesión de conversación
  const session = await prisma.whatsappSession.upsert({
    where:  { phone },
    create: { phone, messages: [] },
    update: {},
  })

  const history: Anthropic.MessageParam[] = (session.messages as any[]) ?? []

  // Agregar mensaje del usuario
  history.push({ role: 'user', content: text })

  // Mantener historial corto (últimas 20 entradas)
  const trimmed = history.slice(-20)

  // Llamar a Claude en loop de herramientas
  let finalText = ''
  const messages: Anthropic.MessageParam[] = [...trimmed]

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 1024,
      system: `Eres el asistente de operaciones de *${user.agency?.name ?? 'HurryOps'}* en WhatsApp.
Ayudas a crear guías de envío, consultar estados y buscar clientes.
Responde siempre en español, de forma concisa y clara, usando formato WhatsApp (*negrita*, _cursiva_).
Cuando vayas a crear una guía, asegúrate de tener: nombre del remitente, nombre y teléfono del destinatario, y dirección de entrega (calle, ciudad, estado). Si falta algún dato, pídelo antes de crear.
No inventes datos. Si no tienes suficiente información, pregunta.
Fecha actual: ${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
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
        const result = await runTool(block.name, block.input, agencyId)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    break
  }

  // Guardar historial actualizado (sin tool results para ahorrar espacio)
  const toSave = messages.filter(m =>
    typeof m.content === 'string' ||
    (Array.isArray(m.content) && m.content.every((b: any) => b.type === 'text'))
  ).slice(-20)

  await prisma.whatsappSession.update({
    where:  { phone },
    data:   { messages: toSave as any },
  })

  if (finalText) await sendWhatsapp(msg.from, finalText)

  return NextResponse.json({ ok: true })
}
