import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { generateGuideNumber } from '@/lib/utils'
import * as XLSX from 'xlsx'

const PKG_MAP: Record<string, string> = {
  PAQUETE: 'PACKAGE', SOBRE: 'ENVELOPE', TARIMA: 'PALLET',
  PACKAGE: 'PACKAGE', ENVELOPE: 'ENVELOPE', PALLET: 'PALLET',
}
const SVC_MAP: Record<string, string> = {
  STANDARD: 'STANDARD', EXPRESS: 'EXPRESS', ECONOMY: 'ECONOMY',
  ESTÁNDAR: 'STANDARD', ESTANDAR: 'STANDARD',
}

function norm(v: unknown): string {
  return String(v ?? '').trim()
}
function normUp(v: unknown): string {
  return norm(v).toUpperCase()
}

interface RowResult {
  row: number
  ok: boolean
  guideNumber?: string
  recipientName?: string
  error?: string
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // ── Parse multipart ───────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: 'Archivo Excel inválido' }, { status: 400 })
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (!rows.length) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  if (rows.length > 500) return NextResponse.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })

  const agency = await prisma.agency.findUnique({
    where: { id: user.agencyId! },
  })
  if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 400 })

  // ── Process each row ──────────────────────────────────────────────────────
  const results: RowResult[] = []
  let created = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2 // excel rows start at 1, +1 for header

    // Validate required fields
    const senderName    = norm(r['nombre_remitente'])
    const recipientName = norm(r['nombre_destinatario'])
    const destStreet    = norm(r['calle_destino'])
    const destCity      = norm(r['ciudad_destino'])
    const destState     = norm(r['estado_destino'])

    const missing: string[] = []
    if (!senderName)    missing.push('nombre_remitente')
    if (!recipientName) missing.push('nombre_destinatario')
    if (!destStreet)    missing.push('calle_destino')
    if (!destCity)      missing.push('ciudad_destino')
    if (!destState)     missing.push('estado_destino')

    if (missing.length) {
      results.push({ row: rowNum, ok: false, error: `Campos obligatorios vacíos: ${missing.join(', ')}` })
      continue
    }

    // Optional fields
    const senderPhone    = norm(r['telefono_remitente']) || undefined
    const senderEmail    = norm(r['email_remitente']) || undefined
    const recipientPhone = norm(r['telefono_destinatario']) || undefined
    const recipientEmail = norm(r['email_destinatario']) || undefined
    const notifyRaw      = normUp(r['notificar_destinatario'])
    const notifyRecipient = notifyRaw === 'SI' || notifyRaw === 'SÍ' || notifyRaw === '1' || notifyRaw === 'TRUE'

    const destColonia    = norm(r['colonia_destino']) || undefined
    const destZip        = norm(r['cp_destino']) || undefined
    const destReferences = norm(r['referencias_destino']) || undefined

    const pkgRaw     = normUp(r['tipo_paquete'])
    const packageType = PKG_MAP[pkgRaw] ?? 'PACKAGE'

    const svcRaw     = normUp(r['servicio'])
    const serviceType = SVC_MAP[svcRaw] ?? 'STANDARD'

    const weightRaw = parseFloat(norm(r['peso_kg']))
    const weight    = isNaN(weightRaw) || weightRaw <= 0 ? undefined : weightRaw

    const piecesRaw = parseInt(norm(r['piezas']))
    const pieces    = isNaN(piecesRaw) || piecesRaw <= 0 ? 1 : piecesRaw

    const valRaw      = parseFloat(norm(r['valor_declarado']))
    const declaredValue = isNaN(valRaw) || valRaw <= 0 ? undefined : valRaw

    const description = norm(r['descripcion']) || undefined
    const notes       = norm(r['notas']) || undefined

    // Create
    try {
      const guideNumber = generateGuideNumber(agency.code)

      const destination = await prisma.address.create({
        data: {
          street: destStreet,
          colonia: destColonia,
          city: destCity,
          state: destState,
          zip: destZip ?? '',
          country: 'MX',
          references: destReferences,
        },
      })

      const shipment = await prisma.shipment.create({
        data: {
          guideNumber, status: 'RECEIVED',
          senderName, senderPhone, senderEmail: senderEmail || null,
          recipientName, recipientPhone, recipientEmail: recipientEmail || null,
          notifyRecipient,
          weight, packageType, serviceType,
          pieces, declaredValue, description, notes,
          agencyId: agency.id,
          createdById: user.id,
          destinationId: destination.id,
        },
      })

      await prisma.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          status: 'RECEIVED',
          description: 'Paquete recibido en bodega',
          createdById: user.id,
        },
      })

      results.push({ row: rowNum, ok: true, guideNumber: shipment.guideNumber, recipientName })
      created++
    } catch (err) {
      results.push({ row: rowNum, ok: false, recipientName, error: 'Error al guardar en base de datos' })
    }
  }

  return NextResponse.json({ created, total: rows.length, results })
}
