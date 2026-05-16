import PDFDocument from 'pdfkit'
import fs from 'fs'

const doc = new PDFDocument({ size: 'A4', margin: 36 })
const out = fs.createWriteStream('C:/Users/ricos/Documents/HurryOps-Demo-Script.pdf')
doc.pipe(out)

const BLUE    = '#1e3a5f'
const LBLUE   = '#e8f0fe'
const GREEN   = '#166534'
const LGREENB = '#dcfce7'
const ORANGE  = '#92400e'
const LORA    = '#fef3c7'
const GRAY    = '#374151'
const LGRAY   = '#f3f4f6'
const WHITE   = '#ffffff'
const RED     = '#dc2626'
const W       = 523  // page width minus margins

// ── helpers ────────────────────────────────────────────────────────────────

function sectionBox(title, emoji, color, bgColor, drawContent) {
  const startY = doc.y
  // measure height by running content in dry run — instead, just draw and clip
  const boxX = 36, boxW = W
  doc.save()

  // draw title bar
  doc.roundedRect(boxX, doc.y, boxW, 28, 4).fill(color)
  doc.fillColor(WHITE).fontSize(13).font('Helvetica-Bold')
  doc.text(`${emoji}  ${title}`, boxX + 10, doc.y - 24, { width: boxW - 20 })
  doc.moveDown(0.2)

  // content area background
  const contentY = doc.y
  drawContent()
  const contentH = doc.y - contentY + 10

  // draw bg rect behind content (behind text — use save/restore)
  doc.save()
  doc.roundedRect(boxX, contentY - 4, boxW, contentH, 4).fill(bgColor)
  doc.restore()

  // re-draw text on top
  doc.restore()
  doc.roundedRect(boxX, startY, boxW, 28, 4).fill(color)
  doc.fillColor(WHITE).fontSize(13).font('Helvetica-Bold')
  doc.text(`${emoji}  ${title}`, boxX + 10, startY + 7, { width: boxW - 20 })
  doc.y = startY + 32
  drawContent()
  doc.moveDown(0.5)

  // border
  doc.roundedRect(boxX, startY, boxW, doc.y - startY + 6, 4)
    .lineWidth(1).stroke(color)
  doc.moveDown(0.5)
}

function row(label, value, highlight = false) {
  const lx = 46
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GRAY)
  doc.text(label + ':', lx, doc.y, { continued: true, width: 160 })
  doc.font('Helvetica').fillColor(highlight ? RED : BLUE)
  doc.text('  ' + value, { width: W - 180 })
}

function bullet(text, bold = false) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11).fillColor(GRAY)
  doc.text('  •  ' + text, 46, doc.y, { width: W - 20 })
}

function msg(label, text) {
  doc.font('Helvetica-Bold').fontSize(11).fillColor(GRAY)
  doc.text(label, 46, doc.y)
  doc.roundedRect(46, doc.y, W - 20, 30, 6).fill('#e0f2fe')
  doc.font('Helvetica').fontSize(11).fillColor('#0c4a6e')
  doc.text(text, 56, doc.y - 22, { width: W - 40 })
  doc.moveDown(0.8)
}

// ── HEADER ─────────────────────────────────────────────────────────────────

doc.rect(0, 0, 595, 70).fill(BLUE)
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(22)
doc.text('HurryOps', 36, 18)
doc.font('Helvetica').fontSize(11).fillColor('#93c5fd')
doc.text('Script de Demo — Para Ramiro', 36, 44)
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(11)
doc.text('hurryops.app', 430, 30, { width: 130, align: 'right' })

doc.y = 85

// ── ANTES DE GRABAR ────────────────────────────────────────────────────────

doc.roundedRect(36, doc.y, W, 80, 6).fill(LGRAY)
doc.font('Helvetica-Bold').fontSize(12).fillColor(BLUE)
doc.text('  ANTES DE GRABAR', 46, doc.y - 72)
doc.font('Helvetica').fontSize(11).fillColor(GRAY)
doc.text('  1.  Abre hurryops.app en el navegador', 46, doc.y - 56)
doc.text('  2.  Abre Gmail en otra pestana  (axesan917@gmail.com)', 46, doc.y - 40)
doc.text('  3.  Ten el celular listo para escanear el QR', 46, doc.y - 24)
doc.moveDown(0.8)

// ── PASO 1 ─────────────────────────────────────────────────────────────────

sectionBox('PASO 1 — NUEVA GUIA', '📦', BLUE, LBLUE, () => {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BLUE)
  doc.text('   Ir a: /dashboard/shipments/new', 46, doc.y, { width: W })
  doc.moveDown(0.4)

  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY)
  doc.text('   REMITENTE', 46, doc.y)
  doc.moveDown(0.2)
  row('Nombre', 'John Williams')
  row('Telefono', '310 555 0192')
  row('Email', 'axesan917@gmail.com')
  row('Calle', '1420 S Figueroa St')
  row('Ciudad / Estado / ZIP', 'Los Angeles, California  90015')
  doc.moveDown(0.3)

  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY)
  doc.text('   DESTINATARIO', 46, doc.y)
  doc.moveDown(0.2)
  row('Nombre', 'Maria Gonzalez')
  row('Telefono', '667 234 5678')
  row('Calle / Colonia', 'Av. del Mar 340, Centro')
  row('Ciudad / Estado / C.P.', 'Mazatlan, Sinaloa  82000')
  row('Notificar destinatario', 'ACTIVAR el checkbox', true)
  doc.moveDown(0.3)

  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY)
  doc.text('   PAQUETE', 46, doc.y)
  doc.moveDown(0.2)
  row('Tipo / Servicio', 'Paquete / Express')
  row('Peso', '2.5 kg')
  row('Descripcion', 'Ropa y accesorios')
  doc.moveDown(0.4)

  doc.roundedRect(46, doc.y, W - 20, 24, 4).fill(BLUE)
  doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE)
  doc.text('  → Presionar GENERAR GUIA', 56, doc.y - 18, { width: W - 40 })
  doc.moveDown(0.3)
})

// ── PASO 2 ─────────────────────────────────────────────────────────────────

sectionBox('PASO 2 — GUIA IMPRIMIBLE', '🖨️', '#1d4ed8', LBLUE, () => {
  bullet('Clic en el envio recien creado')
  bullet('Clic en "Imprimir guia"')
  bullet('Mostrar la etiqueta con los dos codigos QR')
})

// ── PASO 3 ─────────────────────────────────────────────────────────────────

sectionBox('PASO 3 — CORREO AUTOMATICO', '📧', '#065f46', LGREENB, () => {
  bullet('Cambiar a pestana de Gmail')
  bullet('Mostrar correo de  noreply@hurryops.app')
  bullet('"El sistema notifica automaticamente al remitente"', true)
})

// ── PASO 4 ─────────────────────────────────────────────────────────────────

sectionBox('PASO 4 — BODEGA DESDE EL CELULAR', '📱', '#92400e', LORA, () => {
  bullet('Escanear el QR de bodega con el celular')
  doc.moveDown(0.2)
  // PIN highlight
  doc.roundedRect(46, doc.y, 200, 28, 6).fill(ORANGE)
  doc.font('Helvetica-Bold').fontSize(14).fillColor(WHITE)
  doc.text('  PIN:  0530', 56, doc.y - 20, { width: 190 })
  doc.moveDown(0.4)
  bullet('Presionar "Entregar a chofer"')
  bullet('Volver a Gmail — mostrar correo de actualizacion de estado')
})

// ── PASO 5 ─────────────────────────────────────────────────────────────────

sectionBox('PASO 5 — TRACKING PUBLICO', '🌐', '#7c3aed', '#ede9fe', () => {
  bullet('Abrir en el navegador:')
  doc.roundedRect(46, doc.y, W - 20, 24, 4).fill('#7c3aed')
  doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
  doc.text('  hurryops.app/track/[numero-de-guia]', 56, doc.y - 18, { width: W - 40 })
  doc.moveDown(0.4)
  bullet('"Esto es lo que ve el cliente final, sin necesidad de login"', true)
})

// ── PASO 6 ─────────────────────────────────────────────────────────────────

sectionBox('PASO 6 — AGENTE DE WHATSAPP', '💬', '#166534', LGREENB, () => {
  msg('Mensaje 1:', 'Quiero ver mis envios')
  msg('Mensaje 2:', 'Quiero crear una guia para Pedro Ramirez en Guadalajara, Jalisco, Calle Juarez 45, su telefono es 333 456 7890, lo manda Carlos Lopez')
  bullet('Mostrar como el bot crea la guia automaticamente')
  bullet('Mostrar el link de rastreo y el link de impresion')
})

// ── CHEAT SHEET ────────────────────────────────────────────────────────────

doc.moveDown(0.5)
doc.roundedRect(36, doc.y, W, 60, 6).fill(BLUE)
const csY = doc.y
doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
doc.text('PIN BODEGA:  0530', 56, csY + 8, { continued: false })
doc.text('EMAIL DEMO:  axesan917@gmail.com', 56, csY + 24)
doc.text('SITIO:  hurryops.app', 56, csY + 40)

// ── DONE ───────────────────────────────────────────────────────────────────

doc.end()
out.on('finish', () => console.log('✅ PDF generado en Documents: HurryOps-Demo-Script.pdf'))
