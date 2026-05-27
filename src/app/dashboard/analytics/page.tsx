'use client'
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Analytics {
  total:         number
  deliveredToday: number
  deliveryRate:  number | null
  avgDays:       number | null
  statusMap:     Record<string, number>
  chartData:     { date: string; label: string; created: number; delivered: number }[]
  drivers:       { id: string; name: string; total: number; done: number; failed: number; active: number; rate: number | null }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  RECEIVED:         'En bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta',
  DELIVERED:        'Entregado',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}
const STATUS_COLOR: Record<string, string> = {
  RECEIVED:         'bg-blue-500',
  IN_TRANSIT:       'bg-yellow-500',
  OUT_FOR_DELIVERY: 'bg-orange-500',
  DELIVERED:        'bg-emerald-500',
  FAILED:           'bg-red-500',
  RETURNED:         'bg-gray-400',
}
const STATUS_ORDER = ['RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']

// ── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-black ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData]       = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics</h1>
      <Spinner />
    </div>
  )
  if (!data) return null

  const inTransit = (data.statusMap['IN_TRANSIT'] ?? 0) + (data.statusMap['OUT_FOR_DELIVERY'] ?? 0)

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Rendimiento general de la operación</p>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total envíos"
          value={data.total.toLocaleString()}
          sub="histórico"
        />
        <KpiCard
          label="Entregados hoy"
          value={data.deliveredToday}
          sub={new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
          color="text-emerald-600"
        />
        <KpiCard
          label="Tasa de entrega"
          value={data.deliveryRate !== null ? `${data.deliveryRate}%` : '—'}
          sub="entregas exitosas vs cerradas"
          color={data.deliveryRate !== null ? (data.deliveryRate >= 80 ? 'text-emerald-600' : data.deliveryRate >= 60 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-400'}
        />
        <KpiCard
          label="Tiempo promedio"
          value={data.avgDays !== null ? `${data.avgDays}d` : '—'}
          sub="días hasta entrega"
          color="text-blue-600"
        />
      </div>

      {/* ── Activity chart ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Actividad — últimos 14 días</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontSize: 12 }}
              labelStyle={{ fontWeight: 700, color: '#0f172a' }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Area type="monotone" dataKey="created"   name="Registrados" stroke="#3b82f6" strokeWidth={2} fill="url(#gradCreated)"   dot={false} />
            <Area type="monotone" dataKey="delivered" name="Entregados"  stroke="#10b981" strokeWidth={2} fill="url(#gradDelivered)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* ── Status breakdown ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Envíos por estado</h2>
          <div className="space-y-3">
            {STATUS_ORDER.map(status => {
              const count = data.statusMap[status] ?? 0
              const pct   = data.total > 0 ? Math.round((count / data.total) * 100) : 0
              if (count === 0) return null
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOR[status]}`} />
                      <span className="text-sm text-gray-700">{STATUS_LABEL[status]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{count.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${STATUS_COLOR[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mini summary */}
          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-600">{data.statusMap['DELIVERED'] ?? 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">Entregados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-blue-600">{inTransit}</p>
              <p className="text-xs text-gray-400 mt-0.5">En movimiento</p>
            </div>
          </div>
        </div>

        {/* ── Driver performance ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Performance por chofer</h2>
          {data.drivers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin choferes registrados</p>
          ) : (
            <div className="space-y-3">
              {data.drivers.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-violet-600">{d.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                      <span className={`text-xs font-bold ml-2 flex-shrink-0 ${
                        d.rate === null ? 'text-gray-400' :
                        d.rate >= 80 ? 'text-emerald-600' :
                        d.rate >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {d.rate !== null ? `${d.rate}%` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="text-emerald-600 font-medium">✓ {d.done}</span>
                      <span>·</span>
                      <span className="text-red-500 font-medium">✗ {d.failed}</span>
                      {d.active > 0 && <><span>·</span><span className="text-orange-500 font-medium">↗ {d.active} en ruta</span></>}
                    </div>
                    {(d.done + d.failed) > 0 && (
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${d.rate ?? 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bar chart by day ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Volumen diario — últimos 14 días</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={14} barGap={3}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.12)', fontSize: 12 }}
            />
            <Bar dataKey="created"   name="Registrados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="delivered" name="Entregados"  fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}
