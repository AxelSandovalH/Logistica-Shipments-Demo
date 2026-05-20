import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const STATUS_ES: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

const SERVICE_ES: Record<string, string> = {
  STANDARD: 'Estándar',
  EXPRESS:  'Express',
  ECONOMY:  'Económico',
}

const PKG_ES: Record<string, string> = {
  PACKAGE:  'Paquete',
  ENVELOPE: 'Sobre',
  PALLET:   'Tarima',
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status    = searchParams.get('status')
  const search    = searchParams.get('search')
  const dateFrom  = searchParams.get('from')
  const dateTo    = searchParams.get('to')

  const where: any = user.role === 'ADMIN' ? {} : { agencyId: user.agencyId }
  if (status)   where.status = status
  if (search)   where.OR = [
    { guideNumber:   { contains: search, mode: 'insensitive' } },
    { recipientName: { contains: search, mode: 'insensitive' } },
    { senderName:    { contains: search, mode: 'insensitive' } },
  ]
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo)   where.createdAt.lte = new Date(dateTo + 'T23:59:59')
  }

  const shipments = await prisma.shipment.findMany({
    where,
    include: { agency: true, destination: true, origin: true, createdBy: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const rows = shipments.map(s => ({
    'Número de guía':     s.guideNumber,
    'Estado':             STATUS_ES[s.status] ?? s.status,
    'Agencia':            s.agency?.name ?? '',
    'Remitente':          s.senderName,
    'Tel. remitente':     s.senderPhone ?? '',
    'Email remitente':    s.senderEmail ?? '',
    'Origen ciudad':      s.origin?.city ?? '',
    'Origen estado':      s.origin?.state ?? '',
    'Destinatario':       s.recipientName,
    'Tel. destinatario':  s.recipientPhone ?? '',
    'Email destinatario': s.recipientEmail ?? '',
    'Destino calle':      s.destination?.street ?? '',
    'Destino colonia':    s.destination?.colonia ?? '',
    'Destino ciudad':     s.destination?.city ?? '',
    'Destino estado':     s.destination?.state ?? '',
    'Destino C.P.':       s.destination?.zip ?? '',
    'Tipo paquete':       PKG_ES[s.packageType] ?? s.packageType,
    'Servicio':           SERVICE_ES[s.serviceType] ?? s.serviceType,
    'Peso (kg)':          s.weight ?? '',
    'Piezas':             s.pieces,
    'Valor declarado':    s.declaredValue ?? '',
    'Descripción':        s.description ?? '',
    'Notas':              s.notes ?? '',
    'Creado por':         s.createdBy?.name ?? '',
    'Fecha creación':     new Date(s.createdAt).toLocaleDateString('es-MX'),
    'Fecha entrega':      s.deliveredAt ? new Date(s.deliveredAt).toLocaleDateString('es-MX') : '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Envíos')

  // Ancho de columnas automático
  const colWidths = Object.keys(rows[0] ?? {}).map(k => ({
    wch: Math.max(k.length, ...rows.map(r => String((r as any)[k]).length)) + 2,
  }))
  ws['!cols'] = colWidths

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `envios-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
