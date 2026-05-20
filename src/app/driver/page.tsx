'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DriverPage() {
  const router = useRouter()
  const [shipments, setShipments]       = useState<any[]>([])
  const [delivered, setDelivered]       = useState(0)
  const [loading, setLoading]           = useState(true)
  const [onRoute, setOnRoute]           = useState(false)
  const [action, setAction]             = useState<any>(null)
  const [note, setNote]                 = useState('')
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const interval                        = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else fetchShipments()
    })
    return () => { if (interval.current) clearInterval(interval.current) }
  }, [])

  async function fetchShipments() {
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
    navigator.geolocation?.getCurrentPosition(pos => {
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, active }),
      })
    }, null, { enableHighAccuracy: true })
  }

  function startRoute() {
    setOnRoute(true); sendGPS(true)
    interval.current = setInterval(() => sendGPS(true), 30000)
  }
  function stopRoute() {
    setOnRoute(false); sendGPS(false)
    if (interval.current) { clearInterval(interval.current); interval.current = null }
  }

  function openAction(s: any) {
    setAction(s); setNote(''); setPhotoFile(null); setPhotoPreview(null)
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
  }

  async function deliver(status: 'DELIVERED' | 'FAILED') {
    setSaving(true)
    let photoUrl
    if (photoFile) {
      const fd = new FormData(); fd.append('file', photoFile)
      const up = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
      if (up.ok) { const d = await up.json(); photoUrl = d.url }
    }
    await fetch('/api/driver/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: action.id, status, note: note || undefined, photoUrl }),
    })
    setSaving(false); setAction(null)
    fetchShipments()
  }

  async function logout() {
    stopRoute()
    await createClient().auth.signOut()
    router.push('/login')
  }

  const mapsUrl = (s: any) =>
    `https://maps.google.com/?q=${encodeURIComponent(
      [s.destination?.street, s.destination?.colonia, s.destination?.city, s.destination?.state]
        .filter(Boolean).join(', ')
    )}`

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0f1f35] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Cargando ruta...</p>
      </div>
    </div>
  )

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col select-none">

      {/* ── HEADER ── */}
      <div className="bg-[#0f1f35] text-white" style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">HurryOps</p>
            <p className="text-base font-bold mt-0.5">Mi ruta de hoy</p>
          </div>
          <button
            onClick={logout}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
          >
            {/* logout icon inline */}
            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>

        {/* Stats + GPS */}
        <div className="px-5 pb-5 pt-3 flex items-end gap-4">
          {/* Counters */}
          <div className="flex gap-5 flex-1">
            <div>
              <p className="text-3xl font-black leading-none">{shipments.length}</p>
              <p className="text-xs text-white/40 mt-1 font-medium">Pendientes</p>
            </div>
            <div className="w-px bg-white/10 self-stretch mx-1" />
            <div>
              <p className="text-3xl font-black leading-none text-emerald-400">{delivered}</p>
              <p className="text-xs text-white/40 mt-1 font-medium">Entregados</p>
            </div>
          </div>

          {/* GPS pill */}
          <button
            onClick={onRoute ? stopRoute : startRoute}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all active:scale-95 ${
              onRoute
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-white/10 text-white/70'
            }`}
          >
            {/* navigation icon inline */}
            <svg className={`w-4 h-4 ${onRoute ? 'animate-pulse' : ''}`} fill={onRoute ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            {onRoute ? 'GPS ON' : 'Iniciar GPS'}
          </button>
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-3 pb-8">
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <div className="w-20 h-20 rounded-3xl bg-gray-200 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="font-semibold text-gray-500 text-base">Sin entregas asignadas</p>
            <p className="text-sm text-gray-400 mt-1">Tu ruta está vacía por ahora</p>
          </div>
        ) : shipments.map((s, i) => (
          <div key={s.id} className="bg-white rounded-2xl overflow-hidden shadow-sm active:shadow-md transition-shadow">

            {/* Order strip */}
            <div className="h-1 bg-[#0f1f35]" />

            <div className="p-4">
              {/* Name + stop number */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 text-xl leading-tight truncate">{s.recipientName}</p>
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0f1f35] flex items-center justify-center">
                  <span className="text-white text-xs font-black">{i + 1}</span>
                </div>
              </div>

              {/* Phone */}
              {s.recipientPhone && (
                <a
                  href={`tel:${s.recipientPhone}`}
                  className="flex items-center gap-2 mb-3 text-blue-600 active:text-blue-800"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                    </svg>
                  </div>
                  <span className="font-semibold text-sm">{s.recipientPhone}</span>
                </a>
              )}

              {/* Address */}
              {s.destination && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{s.destination.street}</p>
                  {s.destination.colonia && (
                    <p className="text-xs text-gray-500 mt-0.5">Col. {s.destination.colonia}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[s.destination.city, s.destination.state].filter(Boolean).join(', ')}
                  </p>
                  {s.destination.references && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2 font-medium">
                      📌 {s.destination.references}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <a
                  href={mapsUrl(s)}
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:bg-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Navegar
                </a>
                <button
                  onClick={() => openAction(s)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gray-900 text-white text-sm font-bold active:bg-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Registrar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM SHEET MODAL ── */}
      {action && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setAction(null) }}
        >
          <div className="bg-white rounded-t-3xl overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-400 font-medium">Registrar entrega</p>
                <p className="font-black text-gray-900 text-lg leading-tight">{action.recipientName}</p>
              </div>
              <button
                onClick={() => setAction(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pt-4 space-y-3">
              {/* Photo */}
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden">
                  <img src={photoPreview} className="w-full max-h-48 object-cover" alt="Evidencia" />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center active:bg-black/80"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-6 cursor-pointer active:bg-gray-100">
                  <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">Tomar foto de evidencia</p>
                  <p className="text-xs text-gray-400">Opcional</p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                </label>
              )}

              {/* Note */}
              <input
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 border-0"
                placeholder="Nota (opcional) — ej: dejé con vecino"
                value={note}
                onChange={e => setNote(e.target.value)}
              />

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <button
                  onClick={() => deliver('FAILED')}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 text-white font-black text-base active:bg-red-600 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Fallido
                </button>
                <button
                  onClick={() => deliver('DELIVERED')}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white font-black text-base active:bg-emerald-600 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
        </div>
      )}
    </div>
  )
}
