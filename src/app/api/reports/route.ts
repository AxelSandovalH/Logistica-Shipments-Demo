import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const agencyId = searchParams.get('agencyId') // solo admin

  const dateFrom = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d })()
  const dateTo   = to   ? new Date(to + 'T23:59:59') : new Date()

  const baseWhere: any = { createdAt: { gte: dateFrom, lte: dateTo } }
  if (user.role === 'ADMIN') {
    if (agencyId) baseWhere.agencyId = agencyId
  } else {
    baseWhere.agencyId = user.agencyId
  }

  const [shipments, agencies] = await Promise.all([
    prisma.shipment.findMany({
      where: baseWhere,
      select: { status: true, createdAt: true, deliveredAt: true, agencyId: true, serviceType: true, weight: true },
      orderBy: { createdAt: 'asc' },
    }),
    user.role === 'ADMIN'
      ? prisma.agency.findMany({ where: { active: true }, select: { id: true, name: true, code: true } })
      : Promise.resolve([]),
  ])

  // ── Por estado ────────────────────────────────────────────────────────────
  const byStatus: Record<string, number> = {}
  for (const s of shipments) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
  }

  // ── Por día ───────────────────────────────────────────────────────────────
  const dayMap: Record<string, number> = {}
  const msDay = 86400000
  const days  = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / msDay) + 1

  for (let i = 0; i < days; i++) {
    const d = new Date(dateFrom.getTime() + i * msDay)
    dayMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const s of shipments) {
    const key = new Date(s.createdAt).toISOString().slice(0, 10)
    if (key in dayMap) dayMap[key] = (dayMap[key] ?? 0) + 1
  }
  const byDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

  // ── Por agencia (solo admin) ───────────────────────────────────────────────
  const agencyMap: Record<string, { name: string; code: string; total: number; delivered: number }> = {}
  if (user.role === 'ADMIN') {
    for (const a of agencies) agencyMap[a.id] = { name: a.name, code: a.code, total: 0, delivered: 0 }
    for (const s of shipments) {
      if (!agencyMap[s.agencyId]) continue
      agencyMap[s.agencyId].total++
      if (s.status === 'DELIVERED') agencyMap[s.agencyId].delivered++
    }
  }

  // ── Por tipo de servicio ──────────────────────────────────────────────────
  const byService: Record<string, number> = {}
  for (const s of shipments) {
    byService[s.serviceType] = (byService[s.serviceType] ?? 0) + 1
  }

  const total     = shipments.length
  const delivered = byStatus['DELIVERED'] ?? 0
  const failed    = (byStatus['FAILED'] ?? 0) + (byStatus['RETURNED'] ?? 0)
  const inProgress = (byStatus['RECEIVED'] ?? 0) + (byStatus['OUT_FOR_DELIVERY'] ?? 0)
  const rate      = total > 0 ? Math.round((delivered / total) * 100) : 0

  return NextResponse.json({
    total, delivered, failed, inProgress, rate,
    byStatus, byDay, byService,
    byAgency: Object.values(agencyMap).sort((a, b) => b.total - a.total),
    agencies,
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo:   dateTo.toISOString().slice(0, 10),
  })
}
