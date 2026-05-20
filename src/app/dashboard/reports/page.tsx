'use client'
import { useEffect, useState, useCallback } from 'react'
import { Download, TrendingUp, CheckCircle, AlertCircle, Clock, Filter } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recibido', IN_TRANSIT: 'En tránsito', OUT_FOR_DELIVERY: 'En ruta',
  DELIVERED: 'Entregado', FAILED: 'Fallido', RETURNED: 'Devuelto',
}
const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-blue-400', IN_TRANSIT: 'bg-yellow-400', OUT_FOR_DELIVERY: 'bg-orange-400',
  DELIVERED: 'bg-green-500', FAILED: 'bg-red-400', RETURNED: 'bg-gray-400',
}
const SERVICE_LABELS: Record<string, string> = {
  STANDARD: 'Estándar', EXPRESS: 'Express', ECONOMY: 'Económico',
}

function fmt(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function preset(days: number) {
  const to   = new Date()
  const from = new Date(); from.setDate(from.getDate() - (days - 1))
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom]       = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10) })
  const [to, setTo]           = useState(today)
  const [agencyId, setAgencyId] = useState('')
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (agencyId) params.set('agencyId', agencyId)
    const res = await fetch(`/api/reports?${params}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [from, to, agencyId])

  useEffect(() => { fetchData() }, [fetchData])

  function applyPreset(days: number) {
    const p = preset(days)
    setFrom(p.from); setTo(p.to)
  }

  const exportUrl = `/api/shipments/export?from=${from}&to=${to}${agencyId ? `&agencyId=${agencyId}` : ''}`

  const byDay    = data?.byDay ?? []
  const maxCount = Math.max(...byDay.map((d: any) => d.count), 1)

  // Agrupar días por semana si el rango es > 14 días para no saturar la gráfica
  const showEveryN = byDay.length > 30 ? 7 : byDay.length > 14 ? 3 : 1
  const chartDays  = byDay.filter((_: any, i: number) => i % showEveryN === 0 || i === byDay.length - 1)

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500">Análisis operativo por período</p>
        </div>
        <a href={exportUrl} download className="btn-secondary text-sm">
          <Download className="w-4 h-4" /> Exportar Excel
        </a>
      </div>

      {/* Filtros */}
      <div className="card !p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex gap-1">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => applyPreset(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  (() => { const p = preset(d); return p.from === from && p.to === to })()
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="input !py-1.5 !text-sm w-36" />
            <span className="text-gray-400 text-sm">—</span>
            <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
              className="input !py-1.5 !text-sm w-36" />
          </div>
          {data?.agencies?.length > 0 && (
            <select className="input !py-1.5 !text-sm w-48" value={agencyId} onChange={e => setAgencyId(e.target.value)}>
              <option value="">Todas las agencias</option>
              {data.agencies.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button onClick={fetchData} className="btn-primary !py-1.5 text-sm">
            <Filter className="w-4 h-4" /> Aplicar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Calculando...</div>
      ) : !data ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card !p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">Total</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.total}</p>
              <p className="text-xs text-gray-400 mt-1">envíos en el período</p>
            </div>
            <div className="card !p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">Entregados</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.delivered}</p>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${data.rate}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{data.rate}% tasa de entrega</p>
            </div>
            <div className="card !p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">En proceso</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.inProgress}</p>
              <p className="text-xs text-gray-400 mt-1">sin entregar</p>
            </div>
            <div className="card !p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">Fallidos</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.failed}</p>
              <p className="text-xs text-gray-400 mt-1">fallidos + devueltos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Gráfica por día */}
            <div className="card lg:col-span-2">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Envíos por día · {fmt(from)} — {fmt(to)}
              </h2>
              {byDay.length === 0 || data.total === 0 ? (
                <div className="h-32 flex items-center justify-center text-gray-400 text-sm">Sin datos en este período</div>
              ) : (
                <div className="flex items-end gap-px" style={{ height: 120 }}>
                  {byDay.map((d: any, i: number) => (
                    <div
                      key={d.date}
                      title={`${fmt(d.date)}: ${d.count}`}
                      className="flex-1 rounded-t-sm bg-blue-500 hover:bg-blue-400 transition-colors cursor-default"
                      style={{
                        height: `${Math.max((d.count / maxCount) * 100, d.count > 0 ? 4 : 1)}%`,
                        opacity: d.count > 0 ? 1 : 0.15,
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Eje X — solo primero, medio y último */}
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-400">{fmt(byDay[0]?.date)}</span>
                <span className="text-[10px] text-gray-400">{fmt(byDay[Math.floor(byDay.length / 2)]?.date)}</span>
                <span className="text-[10px] text-gray-400">{fmt(byDay[byDay.length - 1]?.date)}</span>
              </div>
            </div>

            {/* Desglose por estado */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Por estado</h2>
              <div className="space-y-3">
                {Object.entries(data.byStatus as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-400'}`} />
                          <span className="text-sm text-gray-600">{STATUS_LABELS[status] ?? status}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-400'}`}
                          style={{ width: `${data.total > 0 ? Math.round((count / data.total) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Por servicio */}
              {Object.keys(data.byService ?? {}).length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Por servicio</p>
                  {Object.entries(data.byService as Record<string, number>).map(([svc, count]) => (
                    <div key={svc} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600">{SERVICE_LABELS[svc] ?? svc}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-indigo-400 h-1.5 rounded-full"
                            style={{ width: `${data.total > 0 ? Math.round((count / data.total) * 100) : 0}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabla por agencia (solo admin) */}
          {data.byAgency?.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Desglose por agencia</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs">Agencia</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Total</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Entregados</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-400 text-xs">Tasa entrega</th>
                      <th className="px-5 py-3 text-left font-medium text-gray-400 text-xs w-40">Progreso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byAgency.map((a: any) => {
                      const rate = a.total > 0 ? Math.round((a.delivered / a.total) * 100) : 0
                      return (
                        <tr key={a.name} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono">{a.code}</span>
                              <span className="font-medium text-gray-900">{a.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{a.total}</td>
                          <td className="px-5 py-3 text-right text-green-600 font-medium">{a.delivered}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-700">{rate}%</td>
                          <td className="px-5 py-3">
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${rate}%` }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
