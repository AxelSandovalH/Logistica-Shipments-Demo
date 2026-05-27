import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const wb = XLSX.utils.book_new()

  // ── Headers ──────────────────────────────────────────────────────────────
  const headers = [
    'nombre_remitente',
    'telefono_remitente',
    'email_remitente',
    'nombre_destinatario',
    'telefono_destinatario',
    'email_destinatario',
    'notificar_destinatario',
    'calle_destino',
    'colonia_destino',
    'ciudad_destino',
    'estado_destino',
    'cp_destino',
    'referencias_destino',
    'tipo_paquete',
    'servicio',
    'peso_kg',
    'piezas',
    'valor_declarado',
    'descripcion',
    'notas',
  ]

  // ── Example row ──────────────────────────────────────────────────────────
  const example = [
    'John Williams',
    '3105550192',
    'john@email.com',
    'María González',
    '6672345678',
    'maria@email.com',
    'SI',
    'Av. del Mar 340',
    'Centro',
    'Mazatlán',
    'Sinaloa',
    '82000',
    'Frente a la plaza',
    'PAQUETE',
    'STANDARD',
    '2.5',
    '1',
    '',
    'Ropa y accesorios',
    '',
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, example])

  // ── Column widths ─────────────────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 16 },
    { wch: 24 }, { wch: 20 }, { wch: 24 }, { wch: 18 }, { wch: 16 },
    { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 8  }, { wch: 14 }, { wch: 24 }, { wch: 20 },
  ]

  // ── Instructions sheet ───────────────────────────────────────────────────
  const infoData = [
    ['PLANTILLA DE IMPORTACIÓN MASIVA — HurryOps'],
    [''],
    ['COLUMNAS OBLIGATORIAS (no dejar vacías):'],
    ['  nombre_remitente, nombre_destinatario, calle_destino, ciudad_destino, estado_destino'],
    [''],
    ['VALORES VÁLIDOS:'],
    ['  notificar_destinatario:  SI  /  NO'],
    ['  tipo_paquete:            PAQUETE  /  SOBRE  /  TARIMA'],
    ['  servicio:                STANDARD  /  EXPRESS  /  ECONOMY'],
    [''],
    ['NOTAS:'],
    ['  - No modificar los nombres de los encabezados (fila 1)'],
    ['  - La fila 2 es solo de ejemplo, puedes borrarla'],
    ['  - Puedes agregar todas las filas que necesites'],
    ['  - Los campos de teléfono deben tener 10 dígitos (sin espacios ni guiones)'],
    ['  - peso_kg acepta decimales (ej. 2.5)'],
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData)
  wsInfo['!cols'] = [{ wch: 70 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Envíos')
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instrucciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-hurryops.xlsx"',
    },
  })
}
