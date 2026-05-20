'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Package, Truck, MapPin, CheckCircle, AlertCircle, RotateCcw, ArrowRight, Loader2, Lock, Delete, Warehouse, Camera, X, Image } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

const STATUS_ICONS: Record<string, any> = {
  RECEIVED: Package, IN_TRANSIT: Truck, OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle, FAILED: AlertCircle, RETURNED: RotateCcw,
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED:         'bg-blue-100 text-blue-700 border-blue-200',
  IN_TRANSIT:       'bg-yellow-100 text-yellow-700 border-yellow-200',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-700 border-orange-200',
  DELIVERED:        'bg-green-100 text-green-700 border-green-200',
  FAILED:           'bg-red-100 text-red-700 border-red-200',
  RETURNED:         'bg-gray-100 text-gray-600 border-gray-200',
}

const NEXT_LABELS: Record<string, string> = {
  IN_TRANSIT:       'Enviar a México',
  RECEIVED:         'Entregar al chofer',
  OUT_FOR_DELIVERY: 'Reintentar entrega',
  RETURNED:         'Marcar como devuelto',
}

const NEXT_COLORS: Record<string, string> = {
  IN_TRANSIT:       'bg-yellow-500 hover:bg-yellow-600',
  RECEIVED:         'bg-emerald-600 hover:bg-emerald-700',
  OUT_FOR_DELIVERY: 'bg-orange-500 hover:bg-orange-600',
  RETURNED:         'bg-gray-500 hover:bg-gray-600',
}

const SESSION_KEY = 'bodega_warehouse'

interface WarehouseInfo {
  id: string
  name: string
  city: string
  state: string
  pin: string
}

export default function BodegaPage() {
  const { guide } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [location, setLocation] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Warehouse session
  const [requiresPin, setRequiresPin] = useState(false)
  const [warehouse, setWarehouse] = useState<WarehouseInfo | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinChecking, setPinChecking] = useState(false)

  async function fetchShipment() {
    const res = await fetch(`/api/bodega/${guide}`)
    if (!res.ok) { setError('Guía no encontrada'); setLoading(false); return }
    const d = await res.json()
    setData(d)
    setRequiresPin(d.requiresPin)

    if (d.requiresPin) {
      // Recuperar bodega de sessionStorage si ya está autenticada
      // Solo restaurar la sesión si el PIN guardado sigue siendo válido
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Verificar que el PIN sigue siendo válido contra el servidor
          fetch(`/api/bodega/${guide}/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: parsed.pin }),
          }).then(r => {
            if (r.ok) setWarehouse(parsed)
            else sessionStorage.removeItem(SESSION_KEY)
          })
        } catch { sessionStorage.removeItem(SESSION_KEY) }
      }
    }
    setLoading(false)
  }

  useEffect(() => { fetchShipment() }, [guide])

  function pressKey(k: string) {
    if (pinInput.length >= 8) return
    setPinInput(p => p + k)
    setPinError('')
  }
  function deleteLast() { setPinInput(p => p.slice(0, -1)) }

  async function verifyPin() {
    if (!pinInput || pinInput.length < 4) return
    setPinChecking(true)
    setPinError('')
    const res = await fetch(`/api/bodega/${guide}/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pinInput }),
    })
    setPinChecking(false)
    if (res.ok) {
      const { warehouse: wh } = await res.json()
      const info: WarehouseInfo = { ...wh, pin: pinInput }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(info))
      setWarehouse(info)
    } else {
      setPinError('PIN incorrecto')
      setPinInput('')
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  async function handleUpdate(status: string) {
    setSaving(true)
    setError('')
    const pin = warehouse?.pin

    let photoUrl: string | undefined
    if (photoFile) {
      setUploading(true)
      const fd = new FormData()
      fd.append('file', photoFile)
      const upRes = await fetch('/api/bodega/upload', { method: 'POST', body: fd })
      setUploading(false)
      if (upRes.ok) { const d = await upRes.json(); photoUrl = d.url }
    }

    const res = await fetch(`/api/bodega/${guide}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, location: location || undefined, pin, photoUrl }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      if (d.requiresPin) {
        setWarehouse(null)
        sessionStorage.removeItem(SESSION_KEY)
      }
      setError(d.error ?? 'Error al actualizar')
      return
    }
    setDone(status)
    setPhotoFile(null)
    setPhotoPreview(null)
    fetchShipment()
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setWarehouse(null)
    setPinInput('')
  }

  // ── Loading ──────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  )

  if (error && !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">Guía no encontrada</p>
        <p className="text-sm text-gray-400 font-mono mt-1">{guide}</p>
      </div>
    </div>
  )

  const { shipment, nextStatuses } = data
  const StatusIcon = STATUS_ICONS[shipment.status] ?? Package

  // ── Pantalla de PIN ──────────────────────────────────
  if (requiresPin && !warehouse) return (
    <div className="min-h-screen bg-blue-900 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mx-auto mb-3">
            <Lock className="w-7 h-7 text-blue-600" />
          </div>
          <p className="font-bold text-gray-900 text-lg">Acceso de Bodega</p>
          <p className="text-sm text-gray-500 mt-1">Ingresa el PIN de tu bodega</p>
          <p className="font-mono text-xs text-gray-400 mt-1">{shipment.guideNumber}</p>
        </div>

        {/* Indicador de dígitos */}
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: Math.max(pinInput.length, 4) }).map((_, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
              i < pinInput.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
            }`} />
          ))}
        </div>

        {pinError && (
          <p className="text-center text-sm text-red-600 bg-red-50 rounded-lg py-2 mb-4">{pinError}</p>
        )}

        {/* Teclado numérico */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['1','2','3','4','5','6','7','8','9'].map(k => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              className="h-14 rounded-xl text-xl font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
            >
              {k}
            </button>
          ))}
          <button
            onClick={deleteLast}
            className="h-14 rounded-xl text-gray-500 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            onClick={() => pressKey('0')}
            className="h-14 rounded-xl text-xl font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={verifyPin}
            disabled={pinInput.length < 4 || pinChecking}
            className="h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center"
          >
            {pinChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Pantalla principal ───────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white px-5 py-4">
        <p className="text-xs text-blue-300 uppercase tracking-wide">HurryOps · Bodega</p>
        <p className="font-mono text-xl font-bold mt-0.5">{shipment.guideNumber}</p>
        <p className="text-xs text-blue-300 mt-0.5">{shipment.agency?.name}</p>
        {warehouse && (
          <div className="flex items-center gap-1 mt-1.5">
            <Warehouse className="w-3 h-3 text-blue-400" />
            <p className="text-xs text-blue-400">{warehouse.name} — {warehouse.city}</p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Estado actual */}
        <div className={`rounded-2xl border-2 p-4 flex items-center gap-3 ${STATUS_COLORS[shipment.status]}`}>
          <StatusIcon className="w-7 h-7 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium opacity-70">Estado actual</p>
            <p className="font-bold text-base">{STATUS_LABELS[shipment.status]}</p>
          </div>
        </div>

        {done && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Estado actualizado a: <span className="font-semibold">{STATUS_LABELS[done]}</span>
          </div>
        )}

        {/* Datos del envío */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Destinatario</p>
            <p className="font-semibold text-gray-900">{shipment.recipientName}</p>
            {shipment.recipientPhone && <p className="text-sm text-gray-500">{shipment.recipientPhone}</p>}
          </div>
          {shipment.destination && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Destino</p>
              <p className="text-sm text-gray-700">{shipment.destination.city}, {shipment.destination.state}</p>
              {shipment.destination.street && <p className="text-xs text-gray-500">{shipment.destination.street}</p>}
            </div>
          )}
          <div className="flex gap-4 text-sm">
            {shipment.weight && <div><p className="text-xs text-gray-400">Peso</p><p className="font-medium">{shipment.weight} kg</p></div>}
            {shipment.pieces > 1 && <div><p className="text-xs text-gray-400">Piezas</p><p className="font-medium">{shipment.pieces}</p></div>}
            {shipment.description && <div><p className="text-xs text-gray-400">Contenido</p><p className="font-medium">{shipment.description}</p></div>}
          </div>
        </div>

        {/* Últimos eventos */}
        {shipment.events?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Últimos movimientos</p>
            <div className="space-y-2">
              {shipment.events.map((e: any, i: number) => (
                <div key={e.id} className={`flex items-start gap-2 text-sm ${i === 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${i === 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className={i === 0 ? 'font-medium' : ''}>{STATUS_LABELS[e.status] ?? e.status}</p>
                    {e.warehouse && (
                      <p className="text-xs text-blue-500">{e.warehouse.city}</p>
                    )}
                    <p className="text-xs">{e.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        {nextStatuses.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Actualizar estado</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ubicación (opcional)"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />

            {/* Evidencia fotográfica */}
            <div>
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> Evidencia fotográfica (opcional)
              </p>
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Evidencia" className="w-full rounded-xl border border-gray-200 object-cover max-h-48" />
                  <button
                    onClick={removePhoto}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-gray-400 text-sm cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors">
                  <Image className="w-5 h-5" />
                  Tomar foto o seleccionar
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>

            {nextStatuses.map((status: string) => (
              <button
                key={status}
                onClick={() => handleUpdate(status)}
                disabled={saving || uploading}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-white font-semibold text-base transition-colors disabled:opacity-60 ${NEXT_COLORS[status] ?? 'bg-blue-500 hover:bg-blue-600'}`}
              >
                <span>{NEXT_LABELS[status] ?? STATUS_LABELS[status]}</span>
                {(saving || uploading) ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              </button>
            ))}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center text-gray-400 text-sm">
            Este envío ya está en su estado final
          </div>
        )}

        {/* Cerrar sesión de bodega */}
        {requiresPin && warehouse && (
          <button
            onClick={logout}
            className="w-full text-xs text-gray-400 py-2 hover:text-gray-600 transition-colors"
          >
            Cerrar sesión de bodega
          </button>
        )}
      </div>
    </div>
  )
}
