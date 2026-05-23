'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

const STATUS_COLOR: Record<string, string> = {
  RECEIVED:         'bg-blue-100 text-blue-700',
  IN_TRANSIT:       'bg-yellow-100 text-yellow-800',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-700',
  DELIVERED:        'bg-emerald-100 text-emerald-700',
  FAILED:           'bg-red-100 text-red-700',
  RETURNED:         'bg-gray-100 text-gray-600',
}

const STATUS_DOT: Record<string, string> = {
  RECEIVED:         'bg-blue-500',
  IN_TRANSIT:       'bg-yellow-500',
  OUT_FOR_DELIVERY: 'bg-orange-500 animate-pulse',
  DELIVERED:        'bg-emerald-500',
  FAILED:           'bg-red-500',
  RETURNED:         'bg-gray-400',
}

export default function PortalHomePage() {
  const router = useRouter()
  const [shipments, setShipments] = useState<any[]>([])
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'all' | 'active' | 'delivered'>('all')

  useEffect(() => {
    fetch('/api/portal/shipments')
      .then(r => {
        if (r.status === 401) { router.push('/portal'); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setShipments(d.shipments ?? [])
        setEmail(d.email ?? '')
        setLoading(false)
      })
  }, [])

  async function logout() {
    await fetch('/api/portal/logout', { method: 'POST' })
    router.push('/portal')
  }

  const filtered = shipments.filter(s => {
    if (filter === 'active')    return !['DELIVERED', 'RETURNED'].includes(s.status)
    if (filter === 'delivered') return s.status === 'DELIVERED'
    return true
  })

  const activeCount    = shipments.filter(s => !['DELIVERED', 'RETURNED'].includes(s.status)).length
  const deliveredCount = shipments.filter(s => s.status === 'DELIVERED').length

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-[#0a1628] text-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-2xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Image src="/logo.png" alt="HurryOps" width={20} height={20} className="rounded" />
              </div>
              <div>
                <p className="text-xs text-blue-300 font-medium">Mis envíos</p>
                <p className="text-sm font-bold text-white leading-tight truncate max-w-[200px]">{email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-xs text-blue-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
            >
              Salir
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4 pb-4">
            {[
              { label: 'Total', value: shipments.length, key: 'all' },
              { label: 'En camino', value: activeCount, key: 'active' },
              { label: 'Entregados', value: deliveredCount, key: 'delivered' },
            ].map(stat => (
              <button
                key={stat.key}
                onClick={() => setFilter(stat.key as any)}
                className={`rounded-xl p-3 text-center transition-all ${
                  filter === stat.key
                    ? 'bg-white text-[#0a1628]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <p className={`text-2xl font-black ${filter === stat.key ? 'text-[#0a1628]' : 'text-white'}`}>{stat.value}</p>
                <p className={`text-xs mt-0.5 ${filter === stat.key ? 'text-gray-500' : 'text-blue-200'}`}>{stat.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shipments list */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-10">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="font-medium">Sin envíos en esta categoría</p>
          </div>
        ) : filtered.map(s => (
          <Link
            key={s.id}
            href={`/track/${s.guideNumber}`}
            className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[s.status]}`} />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status]}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>
                <p className="font-mono text-sm font-bold text-gray-900">{s.guideNumber}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <p className="text-xs text-gray-400">Destinatario</p>
                <p className="font-medium text-gray-900 truncate">{s.recipientName}</p>
              </div>
              {s.destination && (
                <div>
                  <p className="text-xs text-gray-400">Destino</p>
                  <p className="font-medium text-gray-900 truncate">{s.destination.city}, {s.destination.state}</p>
                </div>
              )}
            </div>

            {s.events?.[0] && (
              <p className="text-xs text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100">
                Último movimiento: {new Date(s.events[0].createdAt).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
