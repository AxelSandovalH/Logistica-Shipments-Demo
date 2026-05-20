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
  const router                                        = useRouter()
  const [shipments, setShipments]                     = useState<Shipment[]>([])
  const [delivered, setDelivered]                     = useState(0)
  const [loading, setLoading]                         = useState(true)
  const [onRoute, setOnRoute]                         = useState(false)
  const [action, setAction]                           = useState<Shipment | null>(null)
  const [note, setNote]                               = useState('')
  const [photoFile, setPhotoFile]                     = useState<File | null>(null)
  const [photoPreview, setPhotoPreview]               = useState<string | null>(null)
  const [saving, setSaving]                           = useState(false)
  const interval                                      = useRef<NodeJS.Timeout | null>(null)

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
      setOnRoute(false)
      sendGPS(false)
      if (interval.current) { clearInterval(interval.current); interval.current = null }
    } else {
      setOnRoute(true)
      sendGPS(true)
      interval.current = setInterval(() => sendGPS(true), 30000)
    }
  }

  function openModal(s: Shipment) {
    setAction(s); setNote(''); setPhotoFile(null); setPhotoPreview(null)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  async function submit(status: 'DELIVERED' | 'FAILED') {
    if (!action) return
    setSaving(true)
    let photoUrl: string | undefined
    if (photoFile) {
      const fd = new FormData()
      fd.append('file', photoFile)
      const up = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
      if (up.ok) photoUrl = (await up.json()).url
    }
    await fetch('/api/driver/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: action.id, status, note: note || undefined, photoUrl }),
    })
    setSaving(false)
    setAction(null)
    load()
  }

  async function logout() {
    if (onRoute) toggleRoute()
    await createClient().auth.signOut()
    router.push('/login')
  }

  const navUrl = (s: Shipment) =>
    `https://maps.google.com/?q=${encodeURIComponent(
      [s.destination?.street, s.destination?.colonia, s.destination?.city, s.destination?.state]
        .filter(Boolean).join(', ')
    )}`

  const total = shipments.length + delivered
  const pct   = total > 0 ? Math.round((delivered / total) * 100) : 0

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen bg-[#0a1628] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-[3px] border-white/10 border-t-white animate-spin" />
        <span className="text-white/40 text-sm tracking-wide">Cargando ruta...</span>
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-[#f5f6f8] overflow-hidden">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#0a1628] flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        <div className="px-5 pt-3 pb-5">

          {/* top row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">HurryOps</p>
              <p className="text-white font-bold text-lg mt-0.5">Mi ruta</p>
            </div>
            <button
              onClick={logout}
              className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center active:bg-white/15"
            >
              <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>

          {/* stats row */}
          <div className="flex items-center gap-5 mb-5">
            <div className="flex-1">
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-black text-white leading-none">{shipments.length}</span>
                <span className="text-white/40 text-sm mb-1">pendientes</span>
                <span className="ml-auto text-emerald-400 font-bold text-lg leading-none">{delivered} ✓</span>
              </div>
              {/* progress bar */}
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-white/25 text-xs mt-1">{pct}% completado</p>
            </div>
          </div>

          {/* GPS button */}
          <button
            onClick={toggleRoute}
            className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[.98] ${
              onRoute
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-white/10 text-white/70'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onRoute ? 'bg-white animate-pulse' : 'bg-white/30'}`} />
            {onRoute ? 'GPS activo — toca para detener' : 'Iniciar GPS'}
          </button>

        </div>
      </div>

      {/* ══ LIST ════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">

        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 pb-16">
            <div className="w-20 h-20 rounded-3xl bg-gray-200 flex items-center justify-center">
              <svg className="w-9 h-9 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="font-bold text-gray-500 text-lg">Sin entregas asignadas</p>
            <p className="text-sm text-gray-400">Tu agencia aún no te ha asignado paquetes</p>
          </div>
        ) : (
          <div className="p-4 space-y-3 pb-8">
            {shipments.map((s, i) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,.07)' }}
              >
                {/* colored top stripe — newest (i=0) gets accent color */}
                <div className={`h-1 ${i === 0 ? 'bg-blue-500' : 'bg-gray-200'}`} />

                <div className="p-4">

                  {/* stop # + name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      i === 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="font-black text-gray-900 text-base leading-tight">{s.recipientName}</p>
                      {s.status === 'FAILED' && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Intento fallido
                        </span>
                      )}
                    </div>
                  </div>

                  {/* address block */}
                  {s.destination && (
                    <div className="bg-gray-50 rounded-xl px-3.5 py-3 mb-3">
                      <p className="font-semibold text-gray-800 text-sm leading-snug">
                        {s.destination.street}
                      </p>
                      {s.destination.colonia && (
                        <p className="text-xs text-gray-500 mt-0.5">Col. {s.destination.colonia}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[s.destination.city, s.destination.state].filter(Boolean).join(', ')}
                      </p>
                      {s.destination.references && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-amber-700 font-medium">
                            📌 {s.destination.references}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* phone + actions */}
                  <div className="flex gap-2">
                    {/* call — only if phone exists */}
                    {s.recipientPhone && (
                      <a
                        href={`tel:${s.recipientPhone}`}
                        className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 flex-shrink-0"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
                        </svg>
                      </a>
                    )}

                    <a
                      href={navUrl(s)}
                      target="_blank"
                      className="flex-1 h-12 rounded-xl bg-blue-600 flex items-center justify-center gap-1.5 active:bg-blue-700"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="text-white font-bold text-sm">Navegar</span>
                    </a>

                    <button
                      onClick={() => openModal(s)}
                      className="flex-1 h-12 rounded-xl bg-gray-900 flex items-center justify-center gap-1.5 active:bg-gray-700"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-white font-bold text-sm">Registrar</span>
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ DELIVERY MODAL ══════════════════════════════════════════════════ */}
      {action && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(10,22,40,.7)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget && !saving) setAction(null) }}
        >
          <div
            className="bg-white rounded-t-3xl flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)', maxHeight: '90vh' }}
          >
            {/* handle */}
            <div className="flex justify-center pt-3 mb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* header */}
            <div className="px-5 pt-1 pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-medium">Registrar entrega</p>
                <p className="text-xl font-black text-gray-900 leading-tight">{action.recipientName}</p>
                {action.destination?.street && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[260px]">{action.destination.street}</p>
                )}
              </div>
              <button
                onClick={() => !saving && setAction(null)}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 flex-shrink-0"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pt-4 pb-2 overflow-y-auto flex-1 space-y-3">

              {/* photo */}
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={photoPreview} className="w-full max-h-52 object-cover" alt="Evidencia" />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center"
                  >
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

              {/* note */}
              <input
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Nota opcional — ej: dejé con portero"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {/* action buttons */}
            <div className="px-5 pt-3 pb-1 grid grid-cols-2 gap-3">
              <button
                onClick={() => submit('FAILED')}
                disabled={saving}
                className="py-4 rounded-2xl bg-red-500 text-white font-black text-base active:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fallido
              </button>
              <button
                onClick={() => submit('DELIVERED')}
                disabled={saving}
                className="py-4 rounded-2xl bg-emerald-500 text-white font-black text-base active:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                Entregado
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
