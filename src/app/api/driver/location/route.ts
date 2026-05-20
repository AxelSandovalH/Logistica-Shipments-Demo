import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

// GET — obtener ubicación de un chofer (para tracking público)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const driverId = searchParams.get('driverId')
  if (!driverId) return NextResponse.json({ error: 'driverId requerido' }, { status: 400 })

  const loc = await prisma.driverLocation.findUnique({
    where: { driverId },
    select: { lat: true, lng: true, heading: true, active: true, updatedAt: true },
  })

  if (!loc || !loc.active) return NextResponse.json({ active: false })

  // Si no se actualizó en los últimos 5 minutos, considerar inactivo
  const stale = (Date.now() - new Date(loc.updatedAt).getTime()) > 5 * 60 * 1000
  if (stale) return NextResponse.json({ active: false })

  return NextResponse.json({ active: true, lat: loc.lat, lng: loc.lng, heading: loc.heading, updatedAt: loc.updatedAt })
}

// POST — chofer actualiza su ubicación
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'DRIVER') return NextResponse.json({ error: 'Solo choferes' }, { status: 403 })

  const { lat, lng, heading, active } = await req.json()

  const loc = await prisma.driverLocation.upsert({
    where:  { driverId: user.id },
    create: { driverId: user.id, lat, lng, heading: heading ?? null, active: active ?? true },
    update: { lat, lng, heading: heading ?? null, active: active ?? true },
  })

  return NextResponse.json({ ok: true, loc })
}
