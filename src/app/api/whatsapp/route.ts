import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/ultramsg'
import { generateGuideNumber } from '@/lib/utils'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STATUS_ES: Record<string, string> = {
  RECEIVED:         'Recibido en bodega EE.UU.',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado ✓',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  RECEIVED:         ['IN_TRANSIT'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  FAILED:           ['OUT_FOR_DELIVERY', 'RETURNED'],
}

// ── Herramientas ──────────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  // ── Consulta ─────────────────────────────────────────────────────────────
  {
    name: 'listar_agencias',
    description: 'Lista las agencias activas. Útil para admins que necesitan elegir agencia al crear guías.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'consultar_envio',
    description: 'Busca envíos por número de guía o nombre de remitente/destinatario. Devuelve estado actual.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Número de guía, nombre del destinatario o remitente' },
      },
      required: ['query'],
    },
  },
  {
    name: 'rastrear_envio',
    description: 'Muestra el historial completo de eventos de un envío (timeline de tracking).',
    input_schema: {
      type: 'object' as const,
      properties: {
        guideNumber: { type: 'string', description: 'Número de guía exacto' },
      },
      required: ['guideNumber'],
    },
  },
  {
    name: 'listar_envios',
    description: 'Lista envíos recientes con filtro opcional por estado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status:   { type: 'string', description: 'RECEIVED | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | FAILED | RETURNED. Omitir para todos.' },
        agencyId: { type: 'string', description: 'ID de agencia (solo admin). Omitir para la propia.' },
        limit:    { type: 'number', description: 'Máximo de resultados. Default 10.' },
      },
    },
  },
  {
    name: 'buscar_cliente',
    description: 'Busca un cliente en el directorio por nombre, teléfono o email.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Nombre, teléfono o email del cliente' },
      },
      required: ['search'],
    },
  },
  {
    name: 'ver_analytics',
    description: 'Muestra resumen de operación: entregados hoy, tasa de entrega, envíos activos, tiempo promedio.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agencyId: { type: 'string', description: 'ID de agencia específica (solo admin). Omitir para la propia.' },
      },
    },
  },
  // ── Operaciones ──────────────────────────────────────────────────────────
  {
    name: 'crear_guia',
    description: 'Crea una nueva guía de envío. Reúne todos los datos requeridos antes de llamar. Si es admin sin agencia, llama listar_agencias primero.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agencyId:       { type: 'string',  description: 'ID de la agencia (solo si admin sin agencia)' },
        senderName:     { type: 'string',  description: 'Nombre del remitente' },
        senderPhone:    { type: 'string',  description: 'Teléfono del remitente' },
        senderEmail:    { type: 'string',  description: 'Email del remitente (opcional)' },
        recipientName:  { type: 'string',  description: 'Nombre del destinatario' },
        recipientPhone: { type: 'string',  description: 'Teléfono del destinatario' },
        recipientEmail: { type: 'string',  description: 'Email del destinatario (opcional)' },
        destStreet:     { type: 'string',  description: 'Calle y número del destino' },
        destColonia:    { type: 'string',  description: 'Colonia (opcional)' },
        destCity:       { type: 'string',  description: 'Ciudad del destino' },
        destState:      { type: 'string',  description: 'Estado del destino en México' },
        destZip:        { type: 'string',  description: 'Código postal (opcional)' },
        destReferences: { type: 'string',  description: 'Referencias adicionales (opcional)' },
        weight:         { type: 'number',  description: 'Peso en kg (opcional)' },
        pieces:         { type: 'number',  description: 'Número de piezas. Default 1.' },
        description:    { type: 'string',  description: 'Descripción del contenido (opcional)' },
        serviceType:    { type: 'string',  description: 'STANDARD | EXPRESS | ECONOMY. Default STANDARD.' },
        notifyRecipient:{ type: 'boolean', description: 'Notificar al destinatario por email. Default false.' },
      },
      required: ['senderName', 'recipientName', 'recipientPhone', 'destStreet', 'destCity', 'destState'],
    },
  },
  {
    name: 'actualizar_estado',
    description: 'Cambia el estado de un envío. Solo estados permitidos según el flujo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        guideNumber:  { type: 'string', description: 'Número de guía' },
        nuevoEstado:  { type: 'string', description: 'IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | FAILED | RETURNED' },
        descripcion:  { type: 'string', description: 'Nota o motivo del cambio (opcional)' },
        ubicacion:    { type: 'string', description: 'Ciudad o ubicación actual (opcional)' },
      },
      required: ['guideNumber', 'nuevoEstado'],
    },
  },
  {
    name: 'listar_choferes',
    description: 'Lista los choferes activos de la agencia.',
    input_schema: {
      type: 'object' as const,
      properties: {
        agencyId: { type: 'string', description: 'ID de agencia (solo admin). Omitir para la propia.' },
      },
    },
  },
  {
    name: 'asignar_chofer',
    description: 'Asigna un chofer a un envío. Usa listar_choferes primero para obtener IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        guideNumber: { type: 'string', description: 'Número de guía' },
        driverId:    { type: 'string', description: 'ID del chofer. Pasar null para desasignar.' },
      },
      required: ['guideNumber', 'driverId'],
    },
  },
  {
    name: 'ver_mi_ruta',
    description: 'Para choferes: muestra los envíos asignados a ellos que están pendientes de entregar.',
    input_schema: { type: 'object' as const, properties: {} },
  },
]

// ── Ejecutar herramienta ──────────────────────────────────────────────────────

async function runTool(
  name: string,
  input: any,
  user: { id: string; role: string; agencyId: string | null },
): Promise<string> {
  const userAgencyId = user.agencyId

  // ── listar_agencias ───────────────────────────────────────────────────────
  if (name === 'listar_agencias') {
    const agencies = await prisma.agency.findMany({
      where: { active: true }, orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, city: true, state: true },
    })
    if (!agencies.length) return 'No hay agencias activas.'
    return agencies.map(a =>
      `• *${a.name}* (${a.code})${a.city ? ` — ${a.city}, ${a.state}` : ''}\n  ID: \`${a.id}\``
    ).join('\n')
  }

  // ── consultar_envio ───────────────────────────────────────────────────────
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
      include: { destination: true, agency: true, assignedDriver: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    if (!shipments.length) return 'No se encontraron envíos con esa búsqueda.'
    return shipments.map(s => {
      const dest = [s.destination?.city, s.destination?.state].filter(Boolean).join(', ')
      const driver = s.assignedDriver ? `\n  Chofer: ${s.assignedDriver.name}` : ''
      const agency = !userAgencyId ? `\n  Agencia: ${s.agency?.name}` : ''
      return `• *${s.guideNumber}* — ${STATUS_ES[s.status] ?? s.status}\n  Para: ${s.recipientName} → ${dest}${driver}${agency}`
    }).join('\n\n')
  }

  // ── rastrear_envio ────────────────────────────────────────────────────────
  if (name === 'rastrear_envio') {
    const shipment = await prisma.shipment.findUnique({
      where: { guideNumber: input.guideNumber },
      include: {
        destination: true,
        assignedDriver: { select: { name: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!shipment) return `No se encontró la guía *${input.guideNumber}*.`
    if (userAgencyId && shipment.agencyId !== userAgencyId) return 'No tienes acceso a este envío.'

    const dest = [shipment.destination?.city, shipment.destination?.state].filter(Boolean).join(', ')
    const header = `📦 *${shipment.guideNumber}*\nPara: ${shipment.recipientName} → ${dest}\nEstado: *${STATUS_ES[shipment.status] ?? shipment.status}*${shipment.assignedDriver ? `\nChofer: ${shipment.assignedDriver.name}` : ''}`

    const timeline = shipment.events.map(e => {
      const date = new Date(e.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      const photo = e.photoUrl ? ' 📷' : ''
      const sig   = (e as any).signatureUrl ? ' ✍️' : ''
      return `  ${date} — ${STATUS_ES[e.status] ?? e.status}${photo}${sig}\n  _${e.description}_`
    }).join('\n')

    return `${header}\n\n*Historial:*\n${timeline}\n\n🔗 https://hurryops.app/track/${shipment.guideNumber}`
  }

  // ── listar_envios ─────────────────────────────────────────────────────────
  if (name === 'listar_envios') {
    const effectiveAgency = userAgencyId ?? input.agencyId ?? null
    const where: any = effectiveAgency ? { agencyId: effectiveAgency } : {}
    if (input.status) where.status = input.status
    const take = Math.min(input.limit ?? 10, 20)
    const shipments = await prisma.shipment.findMany({
      where,
      include: { destination: true, agency: true },
      orderBy: { createdAt: 'desc' },
      take,
    })
    if (!shipments.length) return 'No hay envíos con esos filtros.'
    return shipments.map(s => {
      const dest = [s.destination?.city, s.destination?.state].filter(Boolean).join(', ')
      const agency = !userAgencyId ? ` | ${s.agency?.name}` : ''
      return `• *${s.guideNumber}* — ${s.recipientName} → ${dest}\n  ${STATUS_ES[s.status] ?? s.status}${agency}`
    }).join('\n\n')
  }

  // ── buscar_cliente ────────────────────────────────────────────────────────
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
      `• *${c.name}*${c.phone ? ' — ' + c.phone : ''}${c.city ? `, ${c.city}` : ''}${!userAgencyId ? ` (${c.agency?.name})` : ''}`
    ).join('\n')
  }

  // ── ver_analytics ─────────────────────────────────────────────────────────
  if (name === 'ver_analytics') {
    const effectiveAgency = userAgencyId ?? input.agencyId ?? null
    const where: any = effectiveAgency ? { agencyId: effectiveAgency } : {}

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [total, deliveredToday, byStatus, recentDelivered] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.count({ where: { ...where, status: 'DELIVERED', deliveredAt: { gte: today } } }),
      prisma.shipment.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.shipment.findMany({
        where: { ...where, status: 'DELIVERED', deliveredAt: { not: null } },
        select: { createdAt: true, deliveredAt: true },
        orderBy: { deliveredAt: 'desc' },
        take: 50,
      }),
    ])

    const statusMap: Record<string, number> = {}
    for (const g of byStatus) statusMap[g.status] = g._count.id

    const delivered = statusMap['DELIVERED'] ?? 0
    const failed    = statusMap['FAILED']    ?? 0
    const closed    = delivered + failed + (statusMap['RETURNED'] ?? 0)
    const rate      = closed > 0 ? Math.round((delivered / closed) * 100) : null

    let avgDays: string = '—'
    if (recentDelivered.length > 0) {
      const totalMs = recentDelivered.reduce((a, s) => a + (s.deliveredAt!.getTime() - s.createdAt.getTime()), 0)
      avgDays = `${(Math.round(totalMs / recentDelivered.length / 86400000 * 10) / 10)} días`
    }

    const active = (statusMap['IN_TRANSIT'] ?? 0) + (statusMap['OUT_FOR_DELIVERY'] ?? 0)

    return `📊 *Analytics de operación*\n\n` +
      `📦 Total histórico: *${total}*\n` +
      `✅ Entregados hoy: *${deliveredToday}*\n` +
      `🚚 En movimiento: *${active}*\n` +
      `📬 En bodega: *${statusMap['RECEIVED'] ?? 0}*\n` +
      `❌ Intentos fallidos: *${statusMap['FAILED'] ?? 0}*\n` +
      `📈 Tasa de entrega: *${rate !== null ? rate + '%' : '—'}*\n` +
      `⏱ Tiempo promedio: *${avgDays}*`
  }

  // ── crear_guia ────────────────────────────────────────────────────────────
  if (name === 'crear_guia') {
    const resolvedAgencyId = userAgencyId ?? input.agencyId
    if (!resolvedAgencyId) return 'Necesito saber a qué agencia pertenece. Usa listar_agencias y pide que elijan.'

    const agency = await prisma.agency.findUnique({ where: { id: resolvedAgencyId } })
    if (!agency) return 'Agencia no encontrada. Verifica el ID.'

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

    const shipment = await prisma.shipment.create({
      data: {
        guideNumber,
        status:         'RECEIVED',
        senderName:     input.senderName,
        senderPhone:    input.senderPhone    ?? null,
        senderEmail:    input.senderEmail    ?? null,
        recipientName:  input.recipientName,
        recipientPhone: input.recipientPhone ?? null,
        recipientEmail: input.recipientEmail ?? null,
        notifyRecipient: input.notifyRecipient ?? false,
        weight:         input.weight       ?? null,
        description:    input.description  ?? null,
        serviceType:    input.serviceType  ?? 'STANDARD',
        pieces:         input.pieces       ?? 1,
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

    const svcLabel: Record<string, string> = { STANDARD: 'Estándar', EXPRESS: 'Express', ECONOMY: 'Económico' }
    return `✅ *Guía creada*\n\n` +
      `📦 *${guideNumber}*\n` +
      `Agencia: ${agency.name}\n` +
      `Remitente: ${input.senderName}${input.senderPhone ? ' · ' + input.senderPhone : ''}\n` +
      `Destinatario: ${input.recipientName} · ${input.recipientPhone}\n` +
      `Destino: ${input.destStreet}, ${input.destCity}, ${input.destState}\n` +
      `Servicio: ${svcLabel[input.serviceType ?? 'STANDARD']}\n` +
      `Piezas: ${input.pieces ?? 1}\n\n` +
      `🔗 Rastreo: https://hurryops.app/track/${guideNumber}\n` +
      `🖨️ Imprimir guía: https://hurryops.app/print/${guideNumber}`
  }

  // ── actualizar_estado ─────────────────────────────────────────────────────
  if (name === 'actualizar_estado') {
    const shipment = await prisma.shipment.findUnique({ where: { guideNumber: input.guideNumber } })
    if (!shipment) return `No se encontró la guía *${input.guideNumber}*.`
    if (userAgencyId && shipment.agencyId !== userAgencyId) return 'No tienes acceso a este envío.'

    const allowed = STATUS_TRANSITIONS[shipment.status] ?? []
    if (!allowed.includes(input.nuevoEstado)) {
      return `Transición no permitida. El envío está en *${STATUS_ES[shipment.status]}*. Estados posibles: ${allowed.map(s => STATUS_ES[s]).join(', ') || 'ninguno'}.`
    }

    const descriptions: Record<string, string> = {
      IN_TRANSIT:       'Paquete en tránsito hacia México',
      OUT_FOR_DELIVERY: 'Paquete en ruta de entrega',
      DELIVERED:        'Paquete entregado al destinatario',
      FAILED:           'Intento de entrega fallido',
      RETURNED:         'Paquete en proceso de devolución',
    }

    await prisma.$transaction([
      prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: input.nuevoEstado,
          deliveredAt: input.nuevoEstado === 'DELIVERED' ? new Date() : undefined,
        },
      }),
      prisma.trackingEvent.create({
        data: {
          shipmentId:  shipment.id,
          status:      input.nuevoEstado,
          description: input.descripcion || descriptions[input.nuevoEstado] || input.nuevoEstado,
          location:    input.ubicacion ?? null,
          createdById: user.id,
        },
      }),
    ])

    return `✅ Estado actualizado\n*${input.guideNumber}* → *${STATUS_ES[input.nuevoEstado]}*${input.ubicacion ? `\nUbicación: ${input.ubicacion}` : ''}`
  }

  // ── listar_choferes ───────────────────────────────────────────────────────
  if (name === 'listar_choferes') {
    const effectiveAgency = userAgencyId ?? input.agencyId ?? null
    const drivers = await prisma.user.findMany({
      where: {
        role:   'DRIVER',
        active: true,
        ...(effectiveAgency ? { agencyId: effectiveAgency } : {}),
      },
      select: {
        id: true, name: true,
        assignedShipments: {
          where: { status: 'OUT_FOR_DELIVERY' },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    if (!drivers.length) return 'No hay choferes activos registrados.'
    return drivers.map(d =>
      `• *${d.name}* — ${d.assignedShipments.length} en ruta\n  ID: \`${d.id}\``
    ).join('\n')
  }

  // ── asignar_chofer ────────────────────────────────────────────────────────
  if (name === 'asignar_chofer') {
    const shipment = await prisma.shipment.findUnique({
      where: { guideNumber: input.guideNumber },
      include: { events: { select: { status: true } } },
    })
    if (!shipment) return `No se encontró la guía *${input.guideNumber}*.`
    if (userAgencyId && shipment.agencyId !== userAgencyId) return 'No tienes acceso a este envío.'

    const driverId = input.driverId === 'null' ? null : input.driverId

    if (driverId) {
      const driver = await prisma.user.findUnique({ where: { id: driverId } })
      if (!driver || driver.role !== 'DRIVER') return 'Chofer no encontrado. Verifica el ID con listar_choferes.'
    }

    const wentThroughTransit = shipment.events.some((e: any) => e.status === 'IN_TRANSIT')
    const shouldUpdateStatus =
      driverId !== null &&
      wentThroughTransit &&
      !['DELIVERED', 'RETURNED', 'OUT_FOR_DELIVERY'].includes(shipment.status)

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        assignedDriverId: driverId,
        ...(shouldUpdateStatus && { status: 'OUT_FOR_DELIVERY' }),
      },
    })

    if (shouldUpdateStatus) {
      await prisma.trackingEvent.create({
        data: {
          shipmentId:  shipment.id,
          status:      'OUT_FOR_DELIVERY',
          description: 'Asignado a chofer — en ruta de entrega (vía WhatsApp)',
          createdById: user.id,
        },
      })
    }

    if (driverId) {
      const driver = await prisma.user.findUnique({ where: { id: driverId }, select: { name: true } })
      return `✅ *${input.guideNumber}* asignado a *${driver?.name}*${shouldUpdateStatus ? '\nEstado actualizado a: *En ruta de entrega*' : ''}`
    }
    return `✅ Chofer desasignado de *${input.guideNumber}*.`
  }

  // ── ver_mi_ruta ───────────────────────────────────────────────────────────
  if (name === 'ver_mi_ruta') {
    if (user.role !== 'DRIVER') return 'Esta herramienta es solo para choferes.'
    const shipments = await prisma.shipment.findMany({
      where: {
        assignedDriverId: user.id,
        status: { in: ['OUT_FOR_DELIVERY', 'FAILED'] },
      },
      include: { destination: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!shipments.length) return '✅ No tienes entregas pendientes asignadas.'
    const lines = shipments.map((s, i) => {
      const dest  = [s.destination?.street, s.destination?.colonia, s.destination?.city].filter(Boolean).join(', ')
      const badge = s.status === 'FAILED' ? '⚠️ Reintento' : `#${i + 1}`
      return `${badge} *${s.guideNumber}*\n📍 ${dest}\n📞 ${s.recipientPhone ?? 'sin tel'}\n🔗 https://hurryops.app/track/${s.guideNumber}`
    }).join('\n\n')
    return `🚚 *Tu ruta — ${shipments.length} entrega${shipments.length !== 1 ? 's' : ''}*\n\n${lines}`
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

  // Normalizar número — cubre todos los formatos de Ultramsg
  const phonesToTry = Array.from(new Set([
    rawPhone,
    rawPhone.startsWith('521') ? '52' + rawPhone.slice(3) : null,
    rawPhone.startsWith('52') && !rawPhone.startsWith('521') ? '521' + rawPhone.slice(2) : null,
    !rawPhone.startsWith('52') ? '52' + rawPhone : null,
    !rawPhone.startsWith('52') ? '521' + rawPhone : null,
  ].filter(Boolean))) as string[]

  const dbUser = await prisma.user.findFirst({
    where: { whatsappPhone: { in: phonesToTry }, active: true },
    include: { agency: true },
  })

  if (!dbUser) {
    await sendWhatsapp(msg.from, '❌ Tu número no está vinculado a HurryOps. Contacta a tu administrador.')
    return NextResponse.json({ ok: true })
  }
  if (dbUser.role !== 'ADMIN' && !dbUser.agencyId) {
    await sendWhatsapp(msg.from, '❌ Tu usuario no tiene agencia asignada. Contacta a tu administrador.')
    return NextResponse.json({ ok: true })
  }

  const userCtx = { id: dbUser.id, role: dbUser.role, agencyId: dbUser.agencyId ?? null }

  // Historial de conversación
  const session = await prisma.whatsappSession.upsert({
    where:  { phone: rawPhone },
    create: { phone: rawPhone, messages: [] },
    update: {},
  })

  const history: Anthropic.MessageParam[] = (session.messages as any[]) ?? []
  history.push({ role: 'user', content: text })
  const messages: Anthropic.MessageParam[] = history.slice(-30)

  const isAdmin     = dbUser.role === 'ADMIN'
  const isDriver    = dbUser.role === 'DRIVER'
  const agencyLabel = dbUser.agency?.name ?? 'HurryOps'
  const today       = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const systemPrompt = `Eres el asistente operativo de *${agencyLabel}* por WhatsApp.
Rol del usuario: ${isAdmin ? 'Administrador (acceso total)' : isDriver ? 'Chofer' : `Operador de agencia (${agencyLabel})`}.
Fecha: ${today}.

${isDriver ? `Como chofer, el usuario puede:
- Ver su ruta con ver_mi_ruta
- Rastrear envíos específicos con rastrear_envio
- Consultar envíos con consultar_envio` : ''}

${!isDriver ? `Puedes ayudar con:
- Crear guías (crear_guia) — pide todos los datos antes de crear
- Consultar y rastrear envíos (consultar_envio, rastrear_envio, listar_envios)
- Actualizar estados (actualizar_estado) — solo transiciones válidas
- Asignar choferes (asignar_chofer) — usa listar_choferes para ver IDs
- Ver analytics de operación (ver_analytics)
- Buscar clientes (buscar_cliente)` : ''}

${isAdmin && !dbUser.agencyId ? 'Al crear guías, usa listar_agencias primero y pide que el admin elija una.' : ''}

Reglas:
- Responde en español, conciso, formato WhatsApp (*negrita*, _cursiva_).
- No inventes datos. Si te falta información, pregunta.
- Para crear guía necesitas: nombre remitente, nombre + teléfono destinatario, calle + ciudad + estado destino.
- URLs exactas (no modificar):
  Rastreo: https://hurryops.app/track/GUIA
  Imprimir: https://hurryops.app/print/GUIA`

  // Loop de herramientas
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
        const result = await runTool(block.name, block.input, userCtx)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }
      loopMessages.push({ role: 'user', content: results })
      continue
    }

    break
  }

  // Guardar historial — solo texto (no bloques de tool_use) para mantener tamaño razonable
  const toSave = loopMessages.filter(m => {
    if (typeof m.content === 'string') return true
    if (!Array.isArray(m.content)) return false
    return m.content.every((b: any) => b.type === 'text')
  }).slice(-30)

  await prisma.whatsappSession.update({
    where: { phone: rawPhone },
    data:  { messages: toSave as any },
  })

  if (finalText) await sendWhatsapp(msg.from, finalText)
  return NextResponse.json({ ok: true })
}
