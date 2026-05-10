import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { guide: string } }) {
  const { pin } = await req.json()

  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    include: { agency: { select: { warehousePin: true } } },
  })

  if (!shipment) return NextResponse.json({ error: 'Guía no encontrada' }, { status: 404 })

  if (!shipment.agency?.warehousePin) {
    return NextResponse.json({ ok: true }) // Sin PIN configurado, acceso libre
  }

  if (pin !== shipment.agency.warehousePin) {
    return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
