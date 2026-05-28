import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

// ── Colors ────────────────────────────────────────────────────────────────────
const DARK  = rgb(0.04, 0.09, 0.16)
const BLUE  = rgb(0.12, 0.23, 0.37)
const GRAY  = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.95, 0.96, 0.98)
const WHITE = rgb(1, 1, 1)

const STATUS_LABEL: Record<string, string> = {
  RECEIVED:         'En bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta',
  DELIVERED:        'Entregado',
  FAILED:           'Fallido',
  RETURNED:         'Devuelto',
}

function trunc(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ── Layout constants ──────────────────────────────────────────────────────────
// Letter: 612 × 792 pt  |  MARGIN=40  |  usable width=532
// Columns (absolute x positions, all within 40–572):
//   #          x=44   w=16
//   GUÍA       x=64   w=112  (HURRYOPS-20250528-12345 = 22 chars × ~4.8px = 106pt)
//   DESTINAT.  x=180  w=116
//   DESTINO    x=300  w=84
//   ESTADO     x=388  w=76
//   FIRMA      x=468  w=104  → ends at 572 ✓
const C = {
  num:  { x: 44,  w: 16  },
  guid: { x: 64,  w: 112 },
  rec:  { x: 180, w: 116 },
  dest: { x: 300, w: 84  },
  stat: { x: 388, w: 76  },
  sig:  { x: 468, w: 104 },
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const driverId = user.role === 'DRIVER'
    ? user.id
    : (searchParams.get('driverId') ?? user.id)

  const driver = await prisma.user.findUnique({ where: { id: driverId } })
  if (!driver) return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 })

  const shipments = await prisma.shipment.findMany({
    where: { assignedDriverId: driverId, status: 'OUT_FOR_DELIVERY' },
    include: { destination: true, agency: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  if (shipments.length === 0) {
    return NextResponse.json({ error: 'No hay envíos en ruta para generar el manifiesto' }, { status: 404 })
  }

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc    = await PDFDocument.create()
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold)
  const normal = await doc.embedFont(StandardFonts.Helvetica)

  const W      = PageSizes.Letter[0]  // 612
  const H      = PageSizes.Letter[1]  // 792
  const MARGIN = 40
  const COL_W  = W - MARGIN * 2       // 532
  const ROW_H  = 38

  let page = doc.addPage(PageSizes.Letter)
  let y    = H - MARGIN

  function drawHeader() {
    page.drawRectangle({ x: 0, y: H - 72, width: W, height: 72, color: DARK })

    page.drawText('MANIFIESTO DE SALIDA', {
      x: MARGIN, y: H - 26, size: 14, font: bold, color: WHITE,
    })
    page.drawText('HurryOps', {
      x: W - MARGIN - 58, y: H - 26, size: 13, font: bold, color: rgb(0.4, 0.6, 0.9),
    })

    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
    page.drawText(`Chofer: ${driver!.name}`, {
      x: MARGIN, y: H - 52, size: 8.5, font: normal, color: rgb(0.7, 0.8, 0.9),
    })
    page.drawText(`Fecha: ${today}   ·   Total: ${shipments.length} paquete${shipments.length !== 1 ? 's' : ''}`, {
      x: W - MARGIN - 220, y: H - 52, size: 8.5, font: normal, color: rgb(0.7, 0.8, 0.9),
    })

    y = H - 86
  }

  function drawTableHeader() {
    page.drawRectangle({ x: MARGIN, y: y - 20, width: COL_W, height: 22, color: BLUE })

    const headers = [
      { label: '#',           col: C.num  },
      { label: 'GUÍA',        col: C.guid },
      { label: 'DESTINATARIO',col: C.rec  },
      { label: 'DESTINO',     col: C.dest },
      { label: 'ESTADO',      col: C.stat },
      { label: 'FIRMA',       col: C.sig  },
    ]
    headers.forEach(h => {
      page.drawText(h.label, { x: h.col.x + 3, y: y - 14, size: 7, font: bold, color: WHITE })
    })
    y -= 22
  }

  function newPage() {
    page = doc.addPage(PageSizes.Letter)
    y    = H - MARGIN
    drawHeader()
    drawTableHeader()
  }

  drawHeader()
  drawTableHeader()

  shipments.forEach((s, i) => {
    if (y < 90) newPage()

    // Alternating row bg
    if (i % 2 === 0) {
      page.drawRectangle({ x: MARGIN, y: y - ROW_H, width: COL_W, height: ROW_H, color: LIGHT })
    }

    const y1 = y - 13  // first text line
    const y2 = y - 25  // second text line

    // # number
    page.drawText(String(i + 1), {
      x: C.num.x + 2, y: y1, size: 8, font: bold, color: GRAY,
    })

    // Guide number (split into two lines if too long)
    const guide = s.guideNumber
    const parts = guide.split('-')
    if (parts.length === 3) {
      // e.g. HURRYOPS / 20250528 / 12345
      page.drawText(`${parts[0]}-${parts[1]}`, { x: C.guid.x, y: y1, size: 7.5, font: bold,   color: BLUE })
      page.drawText(`-${parts[2]}`,             { x: C.guid.x, y: y2, size: 7.5, font: normal, color: BLUE })
    } else {
      page.drawText(trunc(guide, 20), { x: C.guid.x, y: y1, size: 7.5, font: bold, color: BLUE })
    }

    // Recipient
    page.drawText(trunc(s.recipientName, 20), {
      x: C.rec.x, y: y1, size: 8, font: bold, color: DARK,
    })
    if (s.recipientPhone) {
      page.drawText(s.recipientPhone, {
        x: C.rec.x, y: y2, size: 7, font: normal, color: GRAY,
      })
    }

    // Destination — city/state on line 1, street on line 2
    const city   = [s.destination?.city, s.destination?.state].filter(Boolean).join(', ')
    const street = s.destination?.street ?? ''
    page.drawText(trunc(city,   14), { x: C.dest.x, y: y1, size: 7.5, font: bold,   color: DARK })
    page.drawText(trunc(street, 14), { x: C.dest.x, y: y2, size: 7,   font: normal, color: GRAY })

    // Status badge
    const statusText = STATUS_LABEL[s.status] ?? s.status
    const isDelivered = s.status === 'DELIVERED'
    const badgeFill = isDelivered ? rgb(0.90, 0.98, 0.92) : rgb(0.91, 0.95, 1.0)
    const badgeText = isDelivered ? rgb(0.05, 0.45, 0.15) : rgb(0.10, 0.25, 0.55)
    // Badge: vertically centered in row — bottom-left at y-(ROW_H/2)-7, height=14
    const badgeY = y - (ROW_H / 2) - 7
    page.drawRectangle({ x: C.stat.x, y: badgeY, width: C.stat.w, height: 14, color: badgeFill })
    page.drawText(statusText, {
      x: C.stat.x + 4, y: badgeY + 4, size: 6.5, font: bold, color: badgeText,
    })

    // Signature box — full row height minus small padding
    page.drawRectangle({
      x: C.sig.x, y: y - ROW_H + 3, width: C.sig.w, height: ROW_H - 6,
      color: WHITE, borderColor: rgb(0.82, 0.82, 0.82), borderWidth: 0.5,
    })

    // Row bottom divider
    page.drawLine({
      start: { x: MARGIN, y: y - ROW_H },
      end:   { x: MARGIN + COL_W, y: y - ROW_H },
      thickness: 0.3, color: rgb(0.85, 0.85, 0.85),
    })

    y -= ROW_H
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  if (y < 130) newPage()
  y -= 24

  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + COL_W, y },
    thickness: 0.6, color: rgb(0.78, 0.78, 0.78),
  })
  y -= 18

  page.drawText('Firma del chofer: _________________________________', {
    x: MARGIN, y, size: 9, font: normal, color: DARK,
  })
  page.drawText('Fecha de salida: ______________   Hora: __________', {
    x: MARGIN + 300, y, size: 9, font: normal, color: DARK,
  })

  y -= 32
  page.drawText('Firma del operador de bodega: _________________________________', {
    x: MARGIN, y, size: 9, font: normal, color: DARK,
  })

  // Page numbers
  doc.getPages().forEach((p, idx) => {
    p.drawText(`Página ${idx + 1} de ${doc.getPageCount()}`, {
      x: W - MARGIN - 72, y: 20, size: 7, font: normal, color: GRAY,
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
