'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Shipment = {
  id: string
  guideNumber: string
  recipientName: string
  recipientPhone?: string
  status: string
  destination?: {
    street?: string
    colonia?: string
    city?: string
    state?: string
    references?: string
  }
}

export default function DriverPage() {
  const router                                  = useRouter()
  const [shipments, setShipments]               = useState<Shipment[]>([])
  const [delivered, setDelivered]               = useState(0)
  const [loading, setLoading]                   = useState(true)
  const [onRoute, setOnRoute]                   = useState(false)
  const [action, setAction]                     = useState<Shipment | null>(null)
  const [note, setNote]                         = useState('')
  const [photoFile, setPhotoFile]               = useState<File | null>(null)
  const [photoPreview, setPhotoPreview]         = useState<string | null>(null)
  const [saving, setSaving]                     = useState(false)
  const interval                                = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else load()
    })
    return () => { if (interval.current) clearInterval(interval.current) }
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/driver/route-shipments')
    if (res.ok) {
      const d = await res.json()
      setShipments(d.shipments ?? [])
      setDelivered(d.deliveredToday ?? 0)
    }
    setLoading(false)
  }

  function sendGPS(active: boolean) {
    navigator.geolocation?.getCurrentPosition(p => {
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude, active }),
      })
    }, null, { enableHighAccuracy: true })
  }

  function toggleRoute() {
    if (onRoute) {
      setOnRoute(false); sendGPS(false)
      if (interval.current) { clearInterval(interval.current); interval.current = null }
    } else {
      setOnRoute(true); sendGPS(true)
      interval.current = setInterval(() => sendGPS(true), 30000)
    }
  }

  function openModal(s: Shipment) {
    setAction(s); setNote(''); setPhotoFile(null); setPhotoPreview(null)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
  }

  async function submit(status: 'DELIVERED' | 'FAILED') {
    if (!action) return
    setSaving(true)
    let photoUrl: string | undefined
    if (photoFile) {
      const fd = new FormData(); fd.append('file', photoFile)
      const up = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
      if (up.ok) photoUrl = (await up.json()).url
    }
    await fetch('/api/driver/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: action.id, status, note: note || undefined, photoUrl }),
    })
    setSaving(false); setAction(null); load()
  }

  async function logout() {
    if (onRoute) toggleRoute()
    await createClient().auth.signOut()
    router.push('/login')
  }

  function mapsUrl(s: Shipment) {
    return `https://maps.google.com/?q=${encodeURIComponent(
      [s.destination?.street, s.destination?.colonia, s.destination?.city, s.destination?.state]
        .filter(Boolean).join(', ')
    )}`
  }

  const active  = shipments[0] ?? null
  const pending = shipments.slice(1)
  const total   = shipments.length + delivered
  const pct     = total > 0 ? Math.round((delivered / total) * 100) : 0

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen bg-[#0a1628] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-[3px] border-white/10 border-t-white animate-spin" />
        <p className="text-white/40 text-sm">Cargando ruta...</p>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-[#f0f2f5] overflow-hidden">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#0a1628] flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        <div className="px-5 pt-3 pb-4">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-white/30 uppercase">HurryOps</p>
              <p className="text-white font-bold text-lg leading-tight mt-0.5">Mi ruta</p>
            </div>
            <div className="flex items-center gap-2">
              {/* GPS toggle */}
              <button
                onClick={toggleRoute}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
                  onRoute ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${onRoute ? 'bg-white animate-pulse' : 'bg-white/30'}`} />
                {onRoute ? 'GPS ON' : 'GPS'}
              </button>
              <button onClick={logout} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20">
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/40">{delivered} entregados</span>
                <span className="text-white/40">{shipments.length} pendientes</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="text-white font-black text-xl w-12 text-right">{pct}%</span>
          </div>
        </div>
      </div>

      {/* ══ CONTENT ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">

        {shipments.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3 pb-20">
            <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-sm">
              <svg className="w-9 h-9 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="font-bold text-gray-500 text-lg">Sin entregas asignadas</p>
            <p className="text-sm text-gray-400 text-center px-8">Tu agencia aun no te ha asignado paquetes</p>
          </div>
        ) : (
          <div className="pb-8">

            {/* ── EN CURSO ─────────────────────────────────────────────── */}
            {active && (
              <div className="px-4 pt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">En curso</p>
                <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}>
                  {/* Status bar */}
                  <div className={`h-1.5 ${active.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-500'}`} />

                  <div className="p-5">
                    {/* Recipient */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        {active.status === 'FAILED' && (
                          <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wide mb-1.5">
                            Reintento pendiente
                          </span>
                        )}
                        <p className="text-2xl font-black text-gray-900 leading-tight">{active.recipientName}</p>
                        {active.recipientPhone && (
                          <a href={`tel:${active.recipientPhone}`} className="flex items-center gap-1.5 mt-1.5 text-blue-600 active:text-blue-800">
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                            </svg>
                            <span className="font-semibold text-sm">{active.recipientPhone}</span>
                          </a>
                        )}
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    </div>

                    {/* Address */}
                    {active.destination && (
                      <div className="bg-gray-50 rounded-xl p-3.5 mb-4">
                        <p className="font-bold text-gray-900 text-sm leading-snug">{active.destination.street}</p>
                        {active.destination.colonia && (
                          <p className="text-xs text-gray-500 mt-0.5">Col. {active.destination.colonia}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[active.destination.city, active.destination.state].filter(Boolean).join(', ')}
                        </p>
                        {active.destination.references && (
                          <div className="mt-2 pt-2 border-t border-gray-200 flex items-start gap-1.5">
                            <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                            </svg>
                            <p className="text-xs text-amber-700 font-medium">{active.destination.references}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Main action — Navegar */}
                    <a
                      href={mapsUrl(active)}
                      target="_blank"
                      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-blue-600 text-white font-black text-base mb-2.5 active:bg-blue-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Como llegar — Google Maps
                    </a>

                    {/* Secondary action — Registrar */}
                    <button
                      onClick={() => openModal(active)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-900 text-white font-bold text-sm active:bg-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Registrar entrega
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SIGUIENTES ───────────────────────────────────────────── */}
            {pending.length > 0 && (
              <div className="px-4 pt-5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Siguientes — {pending.length}
                </p>
                <div className="space-y-2">
                  {pending.map((s, i) => (
                    <div key={s.id} className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-black text-gray-400">{i + 2}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{s.recipientName}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {[s.destination?.street, s.destination?.city].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {s.recipientPhone && (
                            <a href={`tel:${s.recipientPhone}`}
                              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200">
                              <svg className="w-3.5 h-3.5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                              </svg>
                            </a>
                          )}
                          <a href={mapsUrl(s)} target="_blank"
                            className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center active:bg-blue-100">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                          </a>
                          <button onClick={() => openModal(s)}
                            className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center active:bg-gray-700">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ DELIVERY MODAL ══════════════════════════════════════════════════ */}
      {action && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(10,22,40,.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget && !saving) setAction(null) }}
        >
          <div className="bg-white rounded-t-3xl flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)', maxHeight: '92vh' }}>
            <div className="flex justify-center pt-3 mb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-medium">Registrar entrega</p>
                <p className="text-xl font-black text-gray-900 leading-tight">{action.recipientName}</p>
                {action.destination?.street && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[260px]">{action.destination.street}</p>
                )}
              </div>
              <button onClick={() => !saving && setAction(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 flex-shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pt-4 pb-2 overflow-y-auto flex-1 space-y-3">
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={photoPreview} className="w-full max-h-52 object-cover" alt="Evidencia" />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-7 cursor-pointer active:bg-gray-100">
                  <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">Foto de evidencia</p>
                  <p className="text-xs text-gray-400">Opcional</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                </label>
              )}
              <input
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Nota opcional — ej: deje con portero"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <div className="px-5 pt-3 pb-1 grid grid-cols-2 gap-3">
              <button onClick={() => submit('FAILED')} disabled={saving}
                className="py-4 rounded-2xl bg-red-500 text-white font-black text-base active:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fallido
              </button>
              <button onClick={() => submit('DELIVERED')} disabled={saving}
                className="py-4 rounded-2xl bg-emerald-500 text-white font-black text-base active:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                }
                Entregado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
