'use client'
import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DriverMap = lazy(() => import('@/components/DriverMap'))

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
  const [gpsPos, setGpsPos]                     = useState<{ lat: number; lng: number } | null>(null)
  const [hasSignature, setHasSignature]         = useState(false)
  const [failReason, setFailReason]             = useState('')
  const [failReasonError, setFailReasonError]   = useState(false)
  const [optimizing, setOptimizing]             = useState(false)
  const [routeOptimized, setRouteOptimized]     = useState(false)
  const [totalKm, setTotalKm]                   = useState<number | null>(null)
  const interval                                = useRef<NodeJS.Timeout | null>(null)
  const sigCanvas                               = useRef<HTMLCanvasElement>(null)
  const isDrawing                               = useRef(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else { load(); registerPush() }
    })
    return () => { if (interval.current) clearInterval(interval.current) }
  }, [])

  async function registerPush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
    } catch (err) {
      console.warn('[push] registration failed:', err)
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw     = atob(base64)
    const output = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
    return output
  }

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
      const lat = p.coords.latitude
      const lng = p.coords.longitude
      setGpsPos({ lat, lng })
      fetch('/api/driver/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, active }),
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
    setAction(s); setNote(''); setPhotoFile(null); setPhotoPreview(null); setHasSignature(false); setFailReason(''); setFailReasonError(false)
    // Clear canvas on next tick (canvas may not be mounted yet)
    setTimeout(() => {
      const c = sigCanvas.current
      if (c) { const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height) }
    }, 50)
  }

  // ── Signature pad helpers ─────────────────────────────────────────────────
  function sigPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top)  * scaleY,
    }
  }

  function sigStart(e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const c = sigCanvas.current; if (!c) return
    isDrawing.current = true
    const ctx = c.getContext('2d')!
    const { x, y } = sigPos(e, c)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  function sigMove(e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing.current) return
    const c = sigCanvas.current; if (!c) return
    const ctx = c.getContext('2d')!
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a5f'
    const { x, y } = sigPos(e, c)
    ctx.lineTo(x, y); ctx.stroke()
    setHasSignature(true)
  }

  function sigEnd() { isDrawing.current = false }

  function clearSignature() {
    const c = sigCanvas.current; if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setHasSignature(false)
  }

  async function sigToBlob(): Promise<Blob | null> {
    return new Promise(resolve => {
      const c = sigCanvas.current
      if (!c) return resolve(null)
      // Flat white background
      const offscreen = document.createElement('canvas')
      offscreen.width = c.width; offscreen.height = c.height
      const ctx = offscreen.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, offscreen.width, offscreen.height)
      ctx.drawImage(c, 0, 0)
      offscreen.toBlob(b => resolve(b), 'image/png')
    })
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
  }

  async function submit(status: 'DELIVERED' | 'FAILED') {
    if (!action) return
    if (status === 'FAILED' && !failReason) { setFailReasonError(true); return }
    setFailReasonError(false)
    setSaving(true)

    // Upload photo
    let photoUrl: string | undefined
    if (photoFile) {
      const fd = new FormData(); fd.append('file', photoFile)
      const up = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
      if (up.ok) photoUrl = (await up.json()).url
    }

    // Upload signature (only for DELIVERED)
    let signatureUrl: string | undefined
    if (status === 'DELIVERED' && hasSignature) {
      const blob = await sigToBlob()
      if (blob) {
        const fd = new FormData()
        fd.append('file', new File([blob], 'firma.png', { type: 'image/png' }))
        const up = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
        if (up.ok) signatureUrl = (await up.json()).url
      }
    }

    // Capturar GPS en el momento exacto de la entrega
    let deliveryLat: number | undefined
    let deliveryLng: number | undefined
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 })
      )
      deliveryLat = pos.coords.latitude
      deliveryLng = pos.coords.longitude
    } catch { /* GPS no disponible, continúa sin coordenadas */ }

    await fetch('/api/driver/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipmentId: action.id, status, signatureUrl, photoUrl,
        lat: deliveryLat, lng: deliveryLng,
        note: status === 'FAILED' ? [failReason, note].filter(Boolean).join(' — ') || undefined : note || undefined,
      }),
    })
    setSaving(false); setAction(null); load()
  }

  async function optimizeRoute() {
    setOptimizing(true)
    const params = new URLSearchParams()
    if (gpsPos) { params.set('lat', String(gpsPos.lat)); params.set('lng', String(gpsPos.lng)) }
    const res = await fetch(`/api/driver/optimize-route?${params}`)
    if (res.ok) {
      const d = await res.json()
      setShipments(d.shipments)
      setRouteOptimized(true)
      setTotalKm(d.totalKm)
    }
    setOptimizing(false)
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
              {shipments.length > 1 && (
                <button
                  onClick={optimizeRoute}
                  disabled={optimizing}
                  title="Optimizar ruta"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                    routeOptimized ? 'bg-emerald-500' : 'bg-white/10 active:bg-white/20'
                  }`}
                >
                  {optimizing
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                  }
                </button>
              )}
              <a
                href="/api/driver/manifest"
                download
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
                title="Descargar manifiesto"
              >
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
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

                  {/* Mapa embebido */}
                  <div className="w-full" style={{ height: '200px' }}>
                    <Suspense fallback={
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                      </div>
                    }>
                      <DriverMap
                        driverLat={gpsPos?.lat ?? null}
                        driverLng={gpsPos?.lng ?? null}
                        destAddress={[
                          active.destination?.street,
                          active.destination?.colonia,
                          active.destination?.city,
                          active.destination?.state,
                        ].filter(Boolean).join(', ')}
                      />
                    </Suspense>
                  </div>

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
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Siguientes — {pending.length}
                  </p>
                  {routeOptimized && totalKm !== null && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Ruta optimizada · ~{totalKm} km
                    </span>
                  )}
                </div>
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
                          {(s as any).distKm > 0 && (
                            <p className="text-[10px] text-blue-500 font-semibold mt-0.5">~{(s as any).distKm} km del anterior</p>
                          )}
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
              {/* ── Signature pad ────────────────────────────────── */}
              <div className="rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-white">
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-600">Firma del cliente</p>
                    {hasSignature
                      ? <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">✓ Firmado</span>
                      : <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Requerido</span>
                    }
                  </div>
                  {hasSignature && (
                    <button onClick={clearSignature} className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium">
                      Borrar
                    </button>
                  )}
                </div>
                <canvas
                  ref={sigCanvas}
                  width={600}
                  height={180}
                  className="w-full touch-none cursor-crosshair"
                  style={{ height: '120px', background: hasSignature ? '#fff' : '#fafafa' }}
                  onMouseDown={sigStart}
                  onMouseMove={sigMove}
                  onMouseUp={sigEnd}
                  onMouseLeave={sigEnd}
                  onTouchStart={sigStart}
                  onTouchMove={sigMove}
                  onTouchEnd={sigEnd}
                />
                {!hasSignature && (
                  <p className="text-center text-xs text-gray-300 pb-2 -mt-1">Pide al cliente que firme aquí</p>
                )}
              </div>

              <input
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Nota opcional — ej: deje con portero"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {/* ── Motivo de incidencia ─────────────────────────── */}
            <div className="px-5 pt-2 pb-1">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                Motivo de incidencia <span className="text-red-400">(requerido si falla)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['Cliente ausente', 'Dirección incorrecta', 'Domicilio cerrado', 'Rechazó el paquete', 'Paquete dañado', 'Otro'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setFailReason(r); setFailReasonError(false) }}
                    className={`text-xs py-2.5 px-3 rounded-xl font-semibold text-left transition-all ${
                      failReason === r
                        ? 'bg-red-500 text-white'
                        : failReasonError
                          ? 'bg-red-50 text-red-400 border border-red-200'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {failReasonError && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">Selecciona un motivo antes de marcar como fallido</p>
              )}
            </div>

            <div className="px-5 pt-3 pb-1 grid grid-cols-2 gap-3">
              <button onClick={() => submit('FAILED')} disabled={saving}
                className="py-4 rounded-2xl bg-red-500 text-white font-black text-base active:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Fallido
              </button>
              <button onClick={() => submit('DELIVERED')} disabled={saving || !hasSignature}
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
