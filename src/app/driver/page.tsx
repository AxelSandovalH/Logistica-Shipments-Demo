'use client'
import { useEffect, useState, useRef } from 'react'
import { MapPin, CheckCircle, XCircle, Camera, X, Package, Navigation, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DriverPage() {
  const router = useRouter()
  const [shipments, setShipments]   = useState<any[]>([])
  const [delivered, setDelivered]   = useState(0)
  const [loading, setLoading]       = useState(true)
  const [onRoute, setOnRoute]       = useState(false)
  const [action, setAction]         = useState<any>(null)
  const [note, setNote]             = useState('')
  const [photoFile, setPhotoFile]   = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const interval                    = useRef<NodeJS.Timeout | null>(null)

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
    if (res.ok) { const d = await res.json(); setShipments(d.shipments ?? []); setDelivered(d.deliveredToday ?? 0) }
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

  if (loading) return (
    <div className="min-h-screen bg-[#1e3a5f] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* Header compacto */}
      <div className="bg-[#1e3a5f] px-5 pt-12 pb-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-4 text-white">
            <div className="text-center">
              <p className="text-2xl font-bold">{shipments.length}</p>
              <p className="text-xs text-blue-300">Por entregar</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{delivered}</p>
              <p className="text-xs text-blue-300">Entregados</p>
            </div>
          </div>
          <button onClick={logout} className="text-blue-300 p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={onRoute ? stopRoute : startRoute}
          className={`w-full py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-colors ${
            onRoute ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          <Navigation className={`w-4 h-4 ${onRoute ? 'animate-pulse' : ''}`} />
          {onRoute ? 'GPS activo — Detener ruta' : 'Iniciar ruta'}
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 p-4 space-y-3">
        {shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Sin entregas asignadas</p>
          </div>
        ) : shipments.map((s, i) => (
          <div key={s.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4">
              {/* Número y nombre */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-lg leading-tight">{s.recipientName}</p>
                  {s.recipientPhone && (
                    <a href={`tel:${s.recipientPhone}`} className="text-blue-600 text-sm font-medium">
                      📞 {s.recipientPhone}
                    </a>
                  )}
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg font-mono shrink-0">#{i + 1}</span>
              </div>

              {/* Dirección */}
              {s.destination && (
                <div className="flex items-start gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-800">{s.destination.street}</p>
                    {s.destination.colonia && <p className="text-xs text-gray-500">Col. {s.destination.colonia}</p>}
                    {s.destination.references && <p className="text-xs text-gray-400 mt-0.5">📌 {s.destination.references}</p>}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([s.destination?.street, s.destination?.colonia, s.destination?.city, s.destination?.state].filter(Boolean).join(', '))}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold"
                >
                  <MapPin className="w-4 h-4" /> Navegar
                </a>
                <button
                  onClick={() => openAction(s)}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold"
                >
                  <CheckCircle className="w-4 h-4" /> Registrar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal registrar */}
      {action && (
        <div className="fixed inset-0 bg-black/60 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{action.recipientName}</p>
              <button onClick={() => setAction(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Foto */}
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} className="w-full rounded-xl max-h-44 object-cover" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 text-sm cursor-pointer">
                <Camera className="w-5 h-5" /> Tomar foto de evidencia
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
              </label>
            )}

            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Nota (opcional)"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3 pb-2">
              <button onClick={() => deliver('FAILED')} disabled={saving}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 text-white font-bold disabled:opacity-60">
                <XCircle className="w-5 h-5" /> No entregado
              </button>
              <button onClick={() => deliver('DELIVERED')} disabled={saving}
                className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-500 text-white font-bold disabled:opacity-60">
                <CheckCircle className="w-5 h-5" /> Entregado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
