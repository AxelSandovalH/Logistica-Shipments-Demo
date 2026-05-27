import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const agencyFilter = user.role === 'ADMIN' ? {} : { agencyId: user.agencyId! }

  const today     = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd  = new Date(today); todayEnd.setHours(23, 59, 59, 999)

  const days14Start = new Date(today)
  days14Start.setDate(today.getDate() - 13)

  // ── Run queries in parallel ───────────────────────────────────────────────
  const [
    allShipments,
    deliveredToday,
    shipments14d,
    driverStats,
  ] = await Promise.all([

    // All shipments with status
    prisma.shipment.groupBy({
      by: ['status'],
      where: agencyFilter,
      _count: { id: true },
    }),

    // Delivered today
    prisma.shipment.count({
      where: { ...agencyFilter, status: 'DELIVERED', deliveredAt: { gte: today, lte: todayEnd } },
    }),

    // Shipments created in last 14 days
    prisma.shipment.findMany({
      where: { ...agencyFilter, createdAt: { gte: days14Start } },
      select: { createdAt: true, status: true },
    }),

    // Driver performance (only for ADMIN and AGENCY roles that can see drivers)
    prisma.user.findMany({
      where: {
        role: 'DRIVER',
        ...(user.role !== 'ADMIN' ? { agencyId: user.agencyId! } : {}),
        active: true,
      },
      select: {
        id: true,
        name: true,
        assignedShipments: {
          where: agencyFilter,
          select: { status: true, deliveredAt: true },
        },
      },
    }),
  ])

  // ── Process status breakdown ──────────────────────────────────────────────
  const statusMap: Record<string, number> = {}
  let total = 0
  for (const g of allShipments) {
    statusMap[g.status] = g._count.id
    total += g._count.id
  }

  const delivered = statusMap['DELIVERED'] ?? 0
  const failed    = statusMap['FAILED']    ?? 0
  const returned  = statusMap['RETURNED']  ?? 0
  const closed    = delivered + failed + returned
  const deliveryRate = closed > 0 ? Math.round((delivered / closed) * 100) : null

  // ── Process 14-day chart ──────────────────────────────────────────────────
  const dayMap: Record<string, { created: number; delivered: number }> = {}
  for (let i = 0; i < 14; i++) {
    const d = new Date(days14Start)
    d.setDate(days14Start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = { created: 0, delivered: 0 }
  }
  for (const s of shipments14d) {
    const key = s.createdAt.toISOString().slice(0, 10)
    if (dayMap[key]) dayMap[key].created++
    if (s.status === 'DELIVERED') {
      const dk = s.createdAt.toISOString().slice(0, 10)
      if (dayMap[dk]) dayMap[dk].delivered++
    }
  }
  const chartData = Object.entries(dayMap).map(([date, v]) => ({
    date,
    label: new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    created:   v.created,
    delivered: v.delivered,
  }))

  // ── Process driver stats ──────────────────────────────────────────────────
  const drivers = driverStats
    .map(d => {
      const total    = d.assignedShipments.length
      const done     = d.assignedShipments.filter(s => s.status === 'DELIVERED').length
      const failed   = d.assignedShipments.filter(s => s.status === 'FAILED').length
      const active   = d.assignedShipments.filter(s => s.status === 'OUT_FOR_DELIVERY').length
      const rate     = (done + failed) > 0 ? Math.round((done / (done + failed)) * 100) : null
      return { id: d.id, name: d.name, total, done, failed, active, rate }
    })
    .sort((a, b) => b.done - a.done)
    .slice(0, 8)

  // ── Average delivery time (days) ──────────────────────────────────────────
  const recentDelivered = await prisma.shipment.findMany({
    where: { ...agencyFilter, status: 'DELIVERED', deliveredAt: { not: null } },
    select: { createdAt: true, deliveredAt: true },
    orderBy: { deliveredAt: 'desc' },
    take: 100,
  })
  let avgDays: number | null = null
  if (recentDelivered.length > 0) {
    const totalMs = recentDelivered.reduce((acc, s) => {
      return acc + (s.deliveredAt!.getTime() - s.createdAt.getTime())
    }, 0)
    avgDays = Math.round((totalMs / recentDelivered.length) / (1000 * 60 * 60 * 24) * 10) / 10
  }

  return NextResponse.json({
    total,
    deliveredToday,
    deliveryRate,
    avgDays,
    statusMap,
    chartData,
    drivers,
  })
}
