'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Package, Truck, MapPin, CheckCircle, AlertCircle, RotateCcw, ArrowRight, Loader2 } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  RECEIVED:         'Recibido en bodega',
  IN_TRANSIT:       'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED:        'Entregado',
  FAILED:           'Intento fallido',
  RETURNED:         'Devuelto',
}

const STATUS_ICONS: Record<string, any> = {
  RECEIVED:         Package,
  IN_TRANSIT:       Truck,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED:        CheckCircle,
  FAILED:           AlertCircle,
  RETURNED:         RotateCcw,
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
  IN_TRANSIT:       'Despachar — En tránsito',
  OUT_FOR_DELIVERY: 'Entregar a chofer — En ruta',
  RECEIVED:         'Regresar a bodega',
  RETURNED:         'Marcar como devuelto',
}

const NEXT_COLORS: Record<string, string> = {
  IN_TRANSIT:       'bg-yellow-500 hover:bg-yellow-600',
  OUT_FOR_DELIVERY: 'bg-orange-500 hover:bg-orange-600',
  RECEIVED:         'bg-blue-500 hover:bg-blue-600',
  RETURNED:         'bg-gray-500 hover:bg-gray-600',
}

export default function BodegaPage() {
  const { guide } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [location, setLocation] = useState('')

  async function fetchShipment() {
    const res = await fetch(`/api/bodega/${guide}`)
    if (res.ok) setData(await res.json())
    else setError('Guía no encontrada')
    setLoading(false)
  }

  useEffect(() => { fetchShipment() }, [guide])

  async function handleUpdate(status: string) {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/bodega/${guide}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, location: location || undefined }),
    })
    setSaving(false)
    if (!res.ok) { setError('Error al actualizar el estado'); return }
    setDone(status)
    fetchShipment()
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-5 py-4">
        <p className="text-xs text-blue-300 uppercase tracking-wide">HurryOps · Bodega</p>
        <p className="font-mono text-xl font-bold mt-0.5">{shipment.guideNumber}</p>
        <p className="text-xs text-blue-300 mt-0.5">{shipment.agency?.name}</p>
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

        {/* Confirmación de acción */}
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
              <p className="text-sm text-gray-700">
                {shipment.destination.city}, {shipment.destination.state}
              </p>
              {shipment.destination.street && (
                <p className="text-xs text-gray-500">{shipment.destination.street}</p>
              )}
            </div>
          )}
          <div className="flex gap-4 text-sm">
            {shipment.weight && (
              <div>
                <p className="text-xs text-gray-400">Peso</p>
                <p className="font-medium">{shipment.weight} kg</p>
              </div>
            )}
            {shipment.pieces > 1 && (
              <div>
                <p className="text-xs text-gray-400">Piezas</p>
                <p className="font-medium">{shipment.pieces}</p>
              </div>
            )}
            {shipment.description && (
              <div>
                <p className="text-xs text-gray-400">Contenido</p>
                <p className="font-medium">{shipment.description}</p>
              </div>
            )}
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
                    <p className="text-xs">{e.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        {nextStatuses.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Actualizar estado</p>
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ubicación (opcional)"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
            {nextStatuses.map((status: string) => (
              <button
                key={status}
                onClick={() => handleUpdate(status)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-xl text-white font-semibold text-base transition-colors disabled:opacity-60 ${NEXT_COLORS[status] ?? 'bg-blue-500 hover:bg-blue-600'}`}
              >
                <span>{NEXT_LABELS[status] ?? STATUS_LABELS[status]}</span>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              </button>
            ))}
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </div>
        )}

        {nextStatuses.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center text-gray-400 text-sm">
            Este envío ya está en su estado final
          </div>
        )}

      </div>
    </div>
  )
}
