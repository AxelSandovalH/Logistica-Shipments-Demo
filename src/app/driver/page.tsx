'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { MapPin, CheckCircle, XCircle, Camera, X, Package, Navigation, LogOut, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  OUT_FOR_DELIVERY: 'border-orange-300 bg-orange-50',
  FAILED:           'border-red-200 bg-red-50',
}

export default function DriverPage() {
  const router = useRouter()
  const [user, setUser]               = useState<any>(null)
  const [shipments, setShipments]     = useState<any[]>([])
  const [delivered, setDelivered]     = useState(0)
  const [loading, setLoading]         = useState(true)
  const [onRoute, setOnRoute]         = useState(false)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [actionShipment, setActionShipment] = useState<any>(null)
  const [note, setNote]               = useState('')
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [locError, setLocError]       = useState('')
  const locationInterval              = useRef<NodeJS.Timeout | null>(null)

  // Cargar usuario y envíos
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      // Fetch user profile
      const res = await fetch('/api/me')
      if (res.ok) { const d = await res.json(); setUser(d) }
      fetchShipments()
    })
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

  // GPS tracking
  function sendLocation(active: boolean) {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            active,
          }),
        })
      },
      err => setLocError('No se pudo obtener ubicación'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function startRoute() {
    if (!navigator.geolocation) { setLocError('GPS no disponible'); return }
    setOnRoute(true)
    setLocError('')
    sendLocation(true)
    locationInterval.current = setInterval(() => sendLocation(true), 30000)
  }

  function stopRoute() {
    setOnRoute(false)
    if (locationInterval.current) { clearInterval(locationInterval.current); locationInterval.current = null }
    sendLocation(false)
  }

  useEffect(() => () => { if (locationInterval.current) clearInterval(locationInterval.current) }, [])

  // Foto
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleDeliver(status: 'DELIVERED' | 'FAILED') {
    if (!actionShipment) return
    setSaving(true)

    let photoUrl: string | undefined
    if (photoFile) {
      const fd = new FormData(); fd.append('file', photoFile)
      const up = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
      if (up.ok) { const d = await up.json(); photoUrl = d.url }
    }

    await fetch('/api/driver/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId: actionShipment.id, status, note: note || undefined, photoUrl }),
    })

    setSaving(false)
    setActionShipment(null)
    setNote(''); setPhotoFile(null); setPhotoPreview(null)
    fetchShipments()
  }

  async function handleLogout() {
    stopRoute()
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pending = shipments.filter(s => s.status === 'OUT_FOR_DELIVERY')
  const failed  = shipments.filter(s => s.status === 'FAILED')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="bg-blue-900 text-white px-5 pt-10 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-blue-300">HurryOps · Chofer</p>
            <p className="font-bold text-lg">{user?.name ?? 'Cargando...'}</p>
          </div>
          <button onClick={handleLogout} className="text-blue-300 hover:text-white p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-blue-300">Pendientes</p>
          </div>
          <div className="bg-blue-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{delivered}</p>
            <p className="text-xs text-blue-300">Entregados hoy</p>
          </div>
          <div className="bg-blue-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{failed.length}</p>
            <p className="text-xs text-blue-300">Fallidos</p>
          </div>
        </div>

        {/* GPS toggle */}
        {locError && <p className="text-xs text-red-300 mb-2">{locError}</p>}
        <button
          onClick={onRoute ? stopRoute : startRoute}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
            onRoute ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          <Navigation className={`w-4 h-4 ${onRoute ? 'animate-pulse' : ''}`} />
          {onRoute ? 'Detener ruta (GPS activo)' : 'Iniciar ruta'}
        </button>
      </div>

      {/* Lista de envíos */}
      <div className="flex-1 p-4 space-y-3">
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Sin envíos asignados</p>
            <p className="text-sm mt-1">Tu agencia aún no te asignó paquetes</p>
          </div>
        ) : (
          <>
            {failed.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-500 font-medium px-1">
                <AlertCircle className="w-3.5 h-3.5" /> {failed.length} intento(s) fallido(s) — reintentar
              </div>
            )}
            {shipments.map(s => (
              <div key={s.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${STATUS_COLORS[s.status] ?? 'border-gray-200'}`}>
                {/* Card header */}
                <button
                  className="w-full flex items-center justify-between p-4"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <div className="text-left">
                    <p className="font-bold text-gray-900">{s.recipientName}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{s.guideNumber}</p>
                    {s.destination && (
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {s.destination.street}, {s.destination.city}
                      </p>
                    )}
                  </div>
                  {expanded === s.id ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                </button>

                {/* Expanded */}
                {expanded === s.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                    <div className="pt-3 space-y-1 text-sm text-gray-600">
                      {s.destination?.colonia && <p>Col. {s.destination.colonia}</p>}
                      {s.destination?.references && <p className="text-xs text-gray-400">Ref: {s.destination.references}</p>}
                      {s.recipientPhone && (
                        <a href={`tel:${s.recipientPhone}`} className="flex items-center gap-1 text-blue-600 font-medium">
                          📞 {s.recipientPhone}
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(`${s.destination?.street}, ${s.destination?.city}, ${s.destination?.state}`)}`}
                        target="_blank"
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
                      >
                        <MapPin className="w-4 h-4" /> Navegar
                      </a>
                      <button
                        onClick={() => { setActionShipment(s); setNote(''); setPhotoFile(null); setPhotoPreview(null) }}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium"
                      >
                        <CheckCircle className="w-4 h-4" /> Registrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal registrar entrega */}
      {actionShipment && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{actionShipment.recipientName}</p>
                <p className="text-xs text-gray-400 font-mono">{actionShipment.guideNumber}</p>
              </div>
              <button onClick={() => setActionShipment(null)} className="text-gray-400 p-1"><X className="w-5 h-5" /></button>
            </div>

            {/* Foto */}
            <div>
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Foto de evidencia</p>
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} className="w-full rounded-xl max-h-48 object-cover" />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 text-sm cursor-pointer">
                  <Camera className="w-5 h-5" /> Tomar foto
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
                </label>
              )}
            </div>

            {/* Nota */}
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              rows={2}
              placeholder="Nota (opcional) — ej: dejé con vecino..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            {/* Botones */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDeliver('FAILED')}
                disabled={saving}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 text-white font-bold text-base disabled:opacity-60"
              >
                <XCircle className="w-5 h-5" /> No entregado
              </button>
              <button
                onClick={() => handleDeliver('DELIVERED')}
                disabled={saving}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-500 text-white font-bold text-base disabled:opacity-60"
              >
                <CheckCircle className="w-5 h-5" /> Entregado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
