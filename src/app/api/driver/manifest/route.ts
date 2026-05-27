import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

// ── Helpers ───────────────────────────────────────────────────────────────────
const DARK  = rgb(0.04, 0.09, 0.16)   // #0a1628
const BLUE  = rgb(0.12, 0.23, 0.37)   // #1e3a5f
const GRAY  = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.95, 0.96, 0.98)
const WHITE = rgb(1, 1, 1)

const STATUS_LABEL: Record<string, string> = {
  RECEIVED:         'En bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta',
  DELIVERED:        'Entregado',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Drivers can only get their own manifest; admins/operators can pass ?driverId=
  const { searchParams } = new URL(req.url)
  const driverId = user.role === 'DRIVER'
    ? user.id
    : (searchParams.get('driverId') ?? user.id)

  const driver = await prisma.user.findUnique({ where: { id: driverId } })
  if (!driver) return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 })

  const shipments = await prisma.shipment.findMany({
    where: {
      assignedDriverId: driverId,
      status: { in: ['OUT_FOR_DELIVERY', 'FAILED'] },
    },
    include: { destination: true, agency: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc    = await PDFDocument.create()
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold)
  const normal = await doc.embedFont(StandardFonts.Helvetica)

  const W = PageSizes.Letter[0]   // 612
  const H = PageSizes.Letter[1]   // 792
  const MARGIN = 40
  const COL_W  = W - MARGIN * 2

  let page = doc.addPage(PageSizes.Letter)
  let y    = H - MARGIN

  // ── Draw helpers ──────────────────────────────────────────────────────────
  function newPage() {
    page = doc.addPage(PageSizes.Letter)
    y    = H - MARGIN
    drawHeader()
  }

  function drawHeader() {
    // Dark band
    page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: DARK })
    page.drawText('MANIFIESTO DE SALIDA', {
      x: MARGIN, y: H - 28, size: 14, font: bold, color: WHITE,
    })
    page.drawText('HurryOps', {
      x: W - MARGIN - 56, y: H - 28, size: 13, font: bold, color: rgb(0.4, 0.6, 0.9),
    })
    // Driver + date strip
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    page.drawText(`Chofer: ${driver!.name}`, {
      x: MARGIN, y: H - 52, size: 9, font: normal, color: rgb(0.7, 0.8, 0.9),
    })
    page.drawText(`Fecha: ${today}  ·  Total: ${shipments.length} paquete${shipments.length !== 1 ? 's' : ''}`, {
      x: W - MARGIN - 210, y: H - 52, size: 9, font: normal, color: rgb(0.7, 0.8, 0.9),
    })
    y = H - 85
  }

  function drawTableHeader() {
    page.drawRectangle({ x: MARGIN, y: y - 18, width: COL_W, height: 20, color: BLUE })
    const cols = [
      { label: '#',          x: MARGIN + 4,   w: 20  },
      { label: 'GUÍA',       x: MARGIN + 28,  w: 90  },
      { label: 'DESTINATARIO', x: MARGIN + 122, w: 130 },
      { label: 'DIRECCIÓN',  x: MARGIN + 256, w: 150 },
      { label: 'ESTADO',     x: MARGIN + 410, w: 80  },
      { label: 'FIRMA',      x: MARGIN + 494, w: 70  },
    ]
    cols.forEach(c => {
      page.drawText(c.label, { x: c.x, y: y - 13, size: 7, font: bold, color: WHITE })
    })
    y -= 20
  }

  // ── Build content ─────────────────────────────────────────────────────────
  drawHeader()
  drawTableHeader()

  shipments.forEach((s, i) => {
    if (y < 80) { newPage(); drawTableHeader() }

    const rowH  = 36
    const isEven = i % 2 === 0
    if (isEven) {
      page.drawRectangle({ x: MARGIN, y: y - rowH, width: COL_W, height: rowH, color: LIGHT })
    }

    const textY  = y - 14
    const textY2 = y - 25

    // #
    page.drawText(String(i + 1), { x: MARGIN + 4, y: textY, size: 8, font: bold, color: DARK })

    // Guide
    page.drawText(s.guideNumber, { x: MARGIN + 28, y: textY, size: 8, font: bold, color: BLUE })

    // Recipient
    page.drawText(truncate(s.recipientName, 22), { x: MARGIN + 122, y: textY, size: 8, font: bold, color: DARK })
    if (s.recipientPhone) {
      page.drawText(s.recipientPhone, { x: MARGIN + 122, y: textY2, size: 7, font: normal, color: GRAY })
    }

    // Address
    const addr = [s.destination?.street, s.destination?.colonia].filter(Boolean).join(', ')
    const city = [s.destination?.city, s.destination?.state].filter(Boolean).join(', ')
    page.drawText(truncate(addr, 26), { x: MARGIN + 256, y: textY,  size: 7.5, font: normal, color: DARK })
    page.drawText(truncate(city, 26), { x: MARGIN + 256, y: textY2, size: 7,   font: normal, color: GRAY })

    // Status badge
    const statusText = STATUS_LABEL[s.status] ?? s.status
    const badgeColor = s.status === 'FAILED' ? rgb(0.99, 0.93, 0.93) : rgb(0.93, 0.99, 0.95)
    const textColor  = s.status === 'FAILED' ? rgb(0.7, 0.1, 0.1)    : rgb(0.1, 0.5, 0.2)
    page.drawRectangle({ x: MARGIN + 410, y: y - 20, width: 70, height: 14, color: badgeColor })
    page.drawText(statusText, { x: MARGIN + 413, y: y - 15, size: 6.5, font: bold, color: textColor })

    // Signature box
    page.drawRectangle({ x: MARGIN + 494, y: y - rowH + 4, width: 70, height: rowH - 8, color: WHITE,
      borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 })

    // Row divider
    page.drawLine({ start: { x: MARGIN, y: y - rowH }, end: { x: MARGIN + COL_W, y: y - rowH },
      thickness: 0.3, color: rgb(0.88, 0.88, 0.88) })

    y -= rowH
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  if (y < 120) newPage()
  y -= 20

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + COL_W, y }, thickness: 0.5, color: rgb(0.8,0.8,0.8) })
  y -= 14

  page.drawText('Firma del chofer: ___________________________________', {
    x: MARGIN, y, size: 9, font: normal, color: DARK,
  })
  page.drawText(`Fecha de salida: _______________  Hora: ___________`, {
    x: MARGIN + 310, y, size: 9, font: normal, color: DARK,
  })

  y -= 30
  page.drawText('Firma del operador de bodega: ___________________________________', {
    x: MARGIN, y, size: 9, font: normal, color: DARK,
  })

  // Page numbers
  doc.getPages().forEach((p, idx) => {
    p.drawText(`Página ${idx + 1} de ${doc.getPageCount()}`, {
      x: W - MARGIN - 70, y: 20, size: 7, font: normal, color: GRAY,
    })
    p.drawText('hurryops.app', {
      x: MARGIN, y: 20, size: 7, font: normal, color: GRAY,
    })
  })

  // ── Serialize ─────────────────────────────────────────────────────────────
  const bytes = Buffer.from(await doc.save())
  const today = new Date().toISOString().slice(0, 10)
  const name  = `manifiesto-${driver.name.toLowerCase().replace(/\s+/g, '-')}-${today}.pdf`

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
