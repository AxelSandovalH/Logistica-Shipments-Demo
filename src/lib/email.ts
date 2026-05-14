import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'HurryOps <noreply@hurryops.app>'
const BASE_URL = 'https://hurryops.app'

const STATUS_LABELS: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado ✓',
  FAILED:           'Intento de entrega fallido',
  RETURNED:         'Devuelto a origen',
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED:         '#3b82f6',
  IN_TRANSIT:       '#eab308',
  OUT_FOR_DELIVERY: '#f97316',
  DELIVERED:        '#22c55e',
  FAILED:           '#ef4444',
  RETURNED:         '#6b7280',
}

function baseTemplate(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HurryOps</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:24px 32px;">
            <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Logística Internacional</p>
            <p style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;">HurryOps</p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© 2025 HurryOps · hurryops.app</p>
            <p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">Este correo fue generado automáticamente, por favor no respondas.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Guía creada ────────────────────────────────────────────────────────────────

interface GuideEmailParams {
  to: string
  guideNumber: string
  senderName: string
  recipientName: string
  recipientPhone?: string | null
  destCity: string
  destState: string
  agencyName: string
  weight?: number | null
  pieces?: number
  description?: string | null
  serviceType?: string
}

export async function sendGuideCreatedEmail(p: GuideEmailParams) {
  const trackingUrl = `${BASE_URL}/track/${p.guideNumber}`

  const serviceLabels: Record<string, string> = {
    STANDARD: 'Estándar',
    EXPRESS:  'Express',
    ECONOMY:  'Económico',
  }

  const html = baseTemplate(`
    <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Nueva guía de envío</p>
    <p style="margin:0 0 24px;color:#111827;font-size:28px;font-weight:700;letter-spacing:1px;font-family:monospace;">${p.guideNumber}</p>

    <!-- Estado badge -->
    <div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 16px;margin-bottom:24px;">
      <p style="margin:0;color:#1d4ed8;font-weight:600;font-size:14px;">📦 Recibido en bodega</p>
    </div>

    <!-- Datos -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="50%" style="padding:0 8px 16px 0;vertical-align:top;">
          <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Remitente</p>
          <p style="margin:0;color:#111827;font-weight:600;">${p.senderName}</p>
        </td>
        <td width="50%" style="padding:0 0 16px 8px;vertical-align:top;">
          <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Destinatario</p>
          <p style="margin:0;color:#111827;font-weight:600;">${p.recipientName}</p>
          ${p.recipientPhone ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px;">${p.recipientPhone}</p>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:0 8px 16px 0;vertical-align:top;">
          <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Destino</p>
          <p style="margin:0;color:#111827;font-weight:600;">${p.destCity}, ${p.destState}</p>
        </td>
        <td style="padding:0 0 16px 8px;vertical-align:top;">
          <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Agencia</p>
          <p style="margin:0;color:#111827;font-weight:600;">${p.agencyName}</p>
        </td>
      </tr>
      ${p.weight || p.pieces || p.description ? `
      <tr>
        <td colspan="2" style="padding-top:8px;border-top:1px solid #f3f4f6;">
          <p style="margin:8px 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Paquete</p>
          <p style="margin:0;color:#374151;font-size:14px;">
            ${[
              p.weight ? `${p.weight} kg` : '',
              p.pieces && p.pieces > 1 ? `${p.pieces} piezas` : '',
              p.description || '',
              p.serviceType ? serviceLabels[p.serviceType] || p.serviceType : '',
            ].filter(Boolean).join(' · ')}
          </p>
        </td>
      </tr>` : ''}
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${trackingUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">
        Rastrear envío
      </a>
      <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;font-family:monospace;">${trackingUrl}</p>
    </div>
  `)

  return resend.emails.send({
    from: FROM,
    to: p.to,
    subject: `Guía ${p.guideNumber} — Tu envío está en camino`,
    html,
  })
}

// ── Actualización de estado ────────────────────────────────────────────────────

interface StatusEmailParams {
  to: string
  guideNumber: string
  recipientName: string
  status: string
  agencyName: string
  warehouseCity?: string | null
  location?: string | null
}

export async function sendStatusUpdateEmail(p: StatusEmailParams) {
  const trackingUrl = `${BASE_URL}/track/${p.guideNumber}`
  const label = STATUS_LABELS[p.status] ?? p.status
  const color = STATUS_COLORS[p.status] ?? '#1e3a5f'

  const isDelivered = p.status === 'DELIVERED'

  const html = baseTemplate(`
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      Hola, te informamos que tu paquete ha sido actualizado.
    </p>

    <!-- Guide -->
    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Número de guía</p>
    <p style="margin:0 0 20px;color:#111827;font-size:20px;font-weight:700;font-family:monospace;">${p.guideNumber}</p>

    <!-- Estado -->
    <div style="background:${color}18;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 2px;color:#6b7280;font-size:12px;">Estado actual</p>
      <p style="margin:0;color:${color};font-size:18px;font-weight:700;">${label}</p>
      ${p.warehouseCity ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">📍 ${p.warehouseCity}</p>` : ''}
      ${p.location ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">📍 ${p.location}</p>` : ''}
    </div>

    ${isDelivered ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:32px;">🎉</p>
      <p style="margin:8px 0 0;color:#15803d;font-weight:600;">¡Tu paquete fue entregado!</p>
      <p style="margin:4px 0 0;color:#16a34a;font-size:13px;">Gracias por confiar en HurryOps.</p>
    </div>` : ''}

    <!-- Info -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:0 8px 12px 0;">
          <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Destinatario</p>
          <p style="margin:0;color:#111827;font-weight:600;">${p.recipientName}</p>
        </td>
        <td style="padding:0 0 12px 8px;">
          <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Agencia</p>
          <p style="margin:0;color:#111827;font-weight:600;">${p.agencyName}</p>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;">
      <a href="${trackingUrl}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;">
        Ver tracking completo
      </a>
    </div>
  `)

  return resend.emails.send({
    from: FROM,
    to: p.to,
    subject: `${label} — Guía ${p.guideNumber}`,
    html,
  })
}
