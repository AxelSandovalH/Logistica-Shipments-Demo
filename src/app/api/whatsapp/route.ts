import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/ultramsg'
import { generateGuideNumber } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Única herramienta: registrar solicitud de envío ───────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: 'registrar_solicitud',
    description: 'Registra una solicitud de envío USA→México. El administrador la revisará y aprobará. Reúne TODOS los datos antes de llamar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        // Remitente
        senderName:     { type: 'string',  description: 'Nombre completo del remitente (USA)' },
        senderPhone:    { type: 'string',  description: 'Teléfono del remitente' },
        senderEmail:    { type: 'string',  description: 'Email del remitente (opcional)' },
        // Destinatario
        recipientName:  { type: 'string',  description: 'Nombre completo del destinatario (México)' },
        recipientPhone: { type: 'string',  description: 'Teléfono del destinatario (10 dígitos)' },
        recipientEmail: { type: 'string',  description: 'Email del destinatario (opcional)' },
        // Dirección destino
        destStreet:     { type: 'string',  description: 'Calle y número del destino' },
        destColonia:    { type: 'string',  description: 'Colonia o fraccionamiento (opcional)' },
        destCity:       { type: 'string',  description: 'Ciudad del destino en México' },
        destState:      { type: 'string',  description: 'Estado de México (ej: Sinaloa, Jalisco)' },
        destZip:        { type: 'string',  description: 'Código postal (opcional)' },
        destReferences: { type: 'string',  description: 'Referencias de la dirección (opcional)' },
        // Paquete
        weight:         { type: 'number',  description: 'Peso en kg (opcional)' },
        pieces:         { type: 'number',  description: 'Número de piezas. Default 1.' },
        description:    { type: 'string',  description: 'Descripción del contenido (opcional)' },
        serviceType:    { type: 'string',  description: 'STANDARD | EXPRESS | ECONOMY. Default STANDARD.' },
        notifyRecipient:{ type: 'boolean', description: 'Notificar al destinatario por correo. Default false.' },
      },
      required: ['senderName', 'senderPhone', 'recipientName', 'recipientPhone', 'destStreet', 'destCity', 'destState'],
    },
  },
]

// ── Ejecutar herramienta ──────────────────────────────────────────────────────
async function runTool(name: string, input: any): Promise<string> {
  if (name !== 'registrar_solicitud') return 'Herramienta no disponible.'

  // Obtener la agencia activa (HurryOps)
  const agency = await prisma.agency.findFirst({ where: { active: true }, orderBy: { createdAt: 'asc' } })
  if (!agency) return 'No hay agencias activas. Contacta al administrador.'

  const guideNumber = generateGuideNumber(agency.code)

  const destination = await prisma.address.create({
    data: {
      street:     input.destStreet,
      colonia:    input.destColonia    ?? null,
      city:       input.destCity,
      state:      input.destState,
      zip:        input.destZip        ?? '',
      country:    'MX',
      references: input.destReferences ?? null,
    },
  })

  await prisma.shipment.create({
    data: {
      guideNumber,
      status:          'PENDING',          // Requiere aprobación del admin
      senderName:      input.senderName,
      senderPhone:     input.senderPhone     ?? null,
      senderEmail:     input.senderEmail     ?? null,
      recipientName:   input.recipientName,
      recipientPhone:  input.recipientPhone  ?? null,
      recipientEmail:  input.recipientEmail  ?? null,
      notifyRecipient: input.notifyRecipient ?? false,
      weight:          input.weight          ?? null,
      description:     input.description     ?? null,
      serviceType:     input.serviceType     ?? 'STANDARD',
      pieces:          input.pieces          ?? 1,
      agencyId:        agency.id,
      destinationId:   destination.id,
      events:          {
        create: {
          status:      'PENDING',
          description: 'Solicitud recibida vía WhatsApp — pendiente de aprobación',
        },
      },
    },
  })

  const svcLabel: Record<string, string> = { STANDARD: 'Estándar', EXPRESS: 'Express', ECONOMY: 'Económico' }
  return (
    `✅ *Solicitud registrada*\n\n` +
    `📋 Referencia: *${guideNumber}*\n` +
    `👤 Remitente: ${input.senderName}\n` +
    `📦 Para: ${input.recipientName}\n` +
    `📍 Destino: ${input.destCity}, ${input.destState}\n` +
    `🚚 Servicio: ${svcLabel[input.serviceType ?? 'STANDARD']}\n` +
    (input.pieces > 1 ? `📦 Piezas: ${input.pieces}\n` : '') +
    `\n⏳ *Pendiente de aprobación por el administrador.*\n` +
    `Recibirás confirmación cuando tu envío sea aceptado.\n\n` +
    `🔗 Seguimiento: https://hurryops.app/track/${guideNumber}`
  )
}

// ── Webhook ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const msg  = body.data
  // Ignorar mensajes salientes (fromMe) y no-texto para evitar bucles
  if (!msg || msg.type !== 'chat' || msg.fromMe) return NextResponse.json({ ok: true })

  const rawPhone = msg.from?.replace('@c.us', '').replace(/\D/g, '') ?? ''
  const text     = msg.body?.trim()
  const msgId    = msg.id ?? null
  if (!rawPhone || !text) return NextResponse.json({ ok: true })

  // ── Deduplicación: ignorar si ya procesamos este mensaje (reintentos UltraMsg) ──
  const session = await prisma.whatsappSession.upsert({
    where:  { phone: rawPhone },
    create: { phone: rawPhone, messages: [], lastMsgId: null },
    update: {},
  })
  if (msgId && session.lastMsgId === msgId) return NextResponse.json({ ok: true })

  const history: Anthropic.MessageParam[] = (session.messages as any[]) ?? []
  history.push({ role: 'user', content: text })
  const messages: Anthropic.MessageParam[] = history.slice(-20)

  const today = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const systemPrompt = `Eres el asistente de envíos de *HurryOps* por WhatsApp. Fecha: ${today}.

Tu única función es registrar solicitudes de envío USA→México para que el administrador las revise y apruebe.

Flujo de conversación:
1. Saluda y explica que puedes registrar solicitudes de envío.
2. Recoge los datos del REMITENTE (nombre y teléfono obligatorios, email opcional).
3. Recoge los datos del DESTINATARIO (nombre, teléfono, dirección en México).
4. Pregunta peso, piezas y servicio (STANDARD/EXPRESS).
5. Confirma todos los datos con el usuario antes de registrar.
6. Llama a registrar_solicitud con todos los datos.
7. Informa que el envío queda *pendiente de aprobación* por el administrador.

Reglas importantes:
- Responde SIEMPRE en español, conciso, formato WhatsApp (*negrita*, _cursiva_).
- NO tienes acceso a consultar envíos, ver estados ni hacer nada más que registrar solicitudes.
- Si te preguntan por el estado de un envío, di que visiten https://hurryops.app/track/NUMERO
- Reúne TODOS los campos requeridos antes de llamar la herramienta.
- Confirma los datos con el usuario antes de registrar.
- Campos mínimos requeridos: nombre remitente, teléfono remitente, nombre destinatario, teléfono destinatario, calle+ciudad+estado destino.`

  let finalText = ''
  let loopMessages = [...messages]

  while (true) {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 1024,
      system:     systemPrompt,
      tools,
      messages:   loopMessages,
    })

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      finalText = textBlock?.type === 'text' ? textBlock.text : ''
      loopMessages.push({ role: 'assistant', content: response.content })
      break
    }

    if (response.stop_reason === 'tool_use') {
      loopMessages.push({ role: 'assistant', content: response.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        const result = await runTool(block.name, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      loopMessages.push({ role: 'user', content: results })
      // Continúa el loop para que Claude genere la respuesta de confirmación
      continue
    }

    break
  }

  // Guardar solo mensajes de texto en historial
  const toSave = loopMessages.filter(m => {
    if (typeof m.content === 'string') return true
    if (!Array.isArray(m.content)) return false
    return (m.content as any[]).every((b: any) => b.type === 'text' || b.type === 'tool_result')
  }).slice(-20)

  await prisma.whatsappSession.update({
    where: { phone: rawPhone },
    data:  { messages: toSave as any, ...(msgId && { lastMsgId: msgId }) },
  })

  if (finalText) await sendWhatsapp(msg.from, finalText)
  return NextResponse.json({ ok: true })
}
