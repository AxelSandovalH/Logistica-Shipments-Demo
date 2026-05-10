import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { guide: string } }) {
  const { pin } = await req.json()

  if (!pin) return NextResponse.json({ error: 'PIN requerido' }, { status: 400 })

  // Buscar bodega activa con este PIN
  const warehouse = await prisma.warehouse.findFirst({
    where: { pin, active: true },
    select: { id: true, name: true, city: true, state: true },
  })

  if (!warehouse) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  // Verificar que la guía existe
  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    select: { id: true },
  })
  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true, warehouse })
}
