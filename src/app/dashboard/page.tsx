import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { Package, TruckIcon, CheckCircle, AlertCircle, Clock, ArrowRight, TrendingUp, Building2 } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const where = user.role === 'ADMIN' ? {} : { agencyId: user.agencyId ?? '' }

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week  = new Date(today); week.setDate(today.getDate() - 6)

  const [
    total, todayCount, inProgress, delivered, failed,
    last7raw, recent, agencyStats,
  ] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.count({ where: { ...where, createdAt: { gte: today } } }),
    prisma.shipment.count({ where: { ...where, status: { in: ['RECEIVED', 'OUT_FOR_DELIVERY'] } } }),
    prisma.shipment.count({ where: { ...where, status: 'DELIVERED' } }),
    prisma.shipment.count({ where: { ...where, status: { in: ['FAILED', 'RETURNED'] } } }),
    prisma.shipment.findMany({
      where: { ...where, createdAt: { gte: week } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { agency: true, destination: true },
    }),
    user.role === 'ADMIN'
      ? prisma.agency.findMany({
          where: { active: true },
          include: {
            _count: { select: { shipments: true } },
            shipments: {
              select: { status: true },
              where: { status: 'DELIVERED' },
            },
          },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  // Agrupar envíos por día (últimos 7 días)
  const days: { label: string; count: number; date: string }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const next = new Date(d); next.setDate(d.getDate() + 1)
    const count = last7raw.filter(s => s.createdAt >= d && s.createdAt < next).length
    days.push({
      date: d.toISOString(),
      label: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
      count,
    })
  }
  const maxDay = Math.max(...days.map(d => d.count), 1)

  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Buenos días, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {user.role === 'ADMIN' ? 'Vista global del sistema' : `Agencia · ${user.agency?.name}`}
          {' · '}
          {now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card !p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hoy</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{todayCount}</p>
          <p className="text-xs text-gray-400">envíos creados hoy</p>
        </div>

        <div className="card !p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-400">envíos histórico</p>
        </div>

        <div className="card !p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">En proceso</span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-orange-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{inProgress}</p>
          <p className="text-xs text-gray-400">sin entregar</p>
        </div>

        <div className="card !p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Entregados</span>
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{delivered}</p>
          <p className="text-xs text-gray-400">completados</p>
        </div>

        <div className="card !p-4 flex flex-col gap-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tasa entrega</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <TruckIcon className="w-3.5 h-3.5 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{deliveryRate}<span className="text-lg font-medium text-gray-400">%</span></p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
            <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${deliveryRate}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gráfica últimos 7 días */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Envíos — últimos 7 días</h2>
            <span className="text-xs text-gray-400">{last7raw.length} total</span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-600">{d.count > 0 ? d.count : ''}</span>
                <div className="w-full flex items-end" style={{ height: '80px' }}>
                  <div
                    className="w-full rounded-t-md bg-blue-500 transition-all hover:bg-blue-600"
                    style={{ height: `${Math.max((d.count / maxDay) * 100, d.count > 0 ? 8 : 2)}%`, minHeight: d.count > 0 ? '4px' : '2px', opacity: d.count > 0 ? 1 : 0.2 }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 text-center leading-tight">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas / resumen rápido */}
        <div className="card flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Resumen operativo</h2>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm text-gray-600">En proceso</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{inProgress}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600">Entregados</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{delivered}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-sm text-gray-600">Fallidos / devueltos</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{failed}</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm text-gray-600">Esta semana</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{last7raw.length}</span>
          </div>

          <Link
            href="/dashboard/shipments"
            className="mt-auto flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Ver todos los envíos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Ranking agencias (solo admin) */}
      {user.role === 'ADMIN' && agencyStats.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              Rendimiento por agencia
            </h2>
            <Link href="/dashboard/agencies" className="text-xs text-blue-600 hover:underline">Gestionar →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agencyStats
              .sort((a, b) => b._count.shipments - a._count.shipments)
              .map(agency => {
                const rate = agency._count.shipments > 0
                  ? Math.round((agency.shipments.length / agency._count.shipments) * 100)
                  : 0
                return (
                  <div key={agency.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-700">{agency.code}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{agency.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{rate}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-gray-900">{agency._count.shipments}</p>
                      <p className="text-[10px] text-gray-400">envíos</p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Envíos recientes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Envíos recientes</h2>
          <Link href="/dashboard/shipments" className="text-xs text-blue-600 hover:underline">Ver todos →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-400 text-xs">Guía</th>
                <th className="pb-3 text-left font-medium text-gray-400 text-xs">Destinatario</th>
                <th className="pb-3 text-left font-medium text-gray-400 text-xs hidden md:table-cell">Destino</th>
                {user.role === 'ADMIN' && <th className="pb-3 text-left font-medium text-gray-400 text-xs hidden lg:table-cell">Agencia</th>}
                <th className="pb-3 text-left font-medium text-gray-400 text-xs">Estado</th>
                <th className="pb-3 text-left font-medium text-gray-400 text-xs hidden sm:table-cell">Fecha</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3">
                    <span className="font-mono text-xs text-blue-700 font-medium">{s.guideNumber}</span>
                  </td>
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{s.recipientName}</p>
                  </td>
                  <td className="py-3 text-gray-500 hidden md:table-cell">
                    {s.destination ? `${s.destination.city}, ${s.destination.state}` : '—'}
                  </td>
                  {user.role === 'ADMIN' && (
                    <td className="py-3 text-gray-400 text-xs hidden lg:table-cell">{s.agency.name}</td>
                  )}
                  <td className="py-3">
                    <span className={`badge ${STATUS_COLORS[s.status]}`}>{STATUS_LABELS[s.status] ?? s.status}</span>
                  </td>
                  <td className="py-3 text-gray-400 text-xs hidden sm:table-cell">
                    {new Date(s.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="py-3">
                    <Link href={`/dashboard/shipments/${s.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">No hay envíos aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
