'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Package, User, Clock, CheckCircle, TruckIcon, AlertCircle, RotateCcw, ExternalLink } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS, PACKAGE_TYPES, SERVICE_TYPES } from '@/lib/utils'

const STATUS_ICONS: Record<string, React.ElementType> = {
  RECEIVED: Package,
  IN_TRANSIT: TruckIcon,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle,
  FAILED: AlertCircle,
  RETURNED: RotateCcw,
}

const NEXT_STATUSES: Record<string, string[]> = {
  RECEIVED: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['OUT_FOR_DELIVERY', 'RETURNED'],
  RETURNED: [],
}

export default function ShipmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [shipment, setShipment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [statusLocation, setStatusLocation] = useState('')

  async function fetchShipment() {
    const res = await fetch(`/api/shipments/${id}`)
    if (res.ok) {
      const data = await res.json()
      setShipment(data.shipment)
    }
    setLoading(false)
  }

  useEffect(() => { fetchShipment() }, [id])

  async function updateStatus() {
    setUpdating(true)
    await fetch(`/api/shipments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, description: statusNote || undefined, location: statusLocation || undefined }),
    })
    setShowStatusModal(false)
    setStatusNote('')
    setStatusLocation('')
    await fetchShipment()
    setUpdating(false)
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>
  if (!shipment) return <div className="p-8 text-gray-400">Envío no encontrado</div>

  const nextStatuses = NEXT_STATUSES[shipment.status] ?? []

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-secondary !px-2 !py-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono text-gray-900">{shipment.guideNumber}</h1>
            <span className={`badge ${STATUS_COLORS[shipment.status]}`}>
              {STATUS_LABELS[shipment.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500">Agencia: {shipment.agency?.name}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/track/${shipment.guideNumber}`}
            target="_blank"
            className="btn-secondary text-xs"
          >
            <ExternalLink className="w-3 h-3" />
            Tracking público
          </a>
          {nextStatuses.length > 0 && (
            <button className="btn-primary" onClick={() => setShowStatusModal(true)}>
              Actualizar estado
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Remitente / Destinatario */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm text-gray-700">Remitente (EE.UU.)</h3>
              </div>
              <p className="font-medium text-gray-900">{shipment.senderName}</p>
              {shipment.senderPhone && <p className="text-sm text-gray-500">{shipment.senderPhone}</p>}
              {shipment.senderEmail && <p className="text-sm text-gray-500">{shipment.senderEmail}</p>}
              {shipment.origin && (
                <p className="text-xs text-gray-400 mt-2">
                  {shipment.origin.street}, {shipment.origin.city}, {shipment.origin.state}
                </p>
              )}
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm text-gray-700">Destinatario (México)</h3>
              </div>
              <p className="font-medium text-gray-900">{shipment.recipientName}</p>
              {shipment.recipientPhone && <p className="text-sm text-gray-500">{shipment.recipientPhone}</p>}
              {shipment.recipientEmail && <p className="text-sm text-gray-500">{shipment.recipientEmail}</p>}
              {shipment.destination && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600">
                    {shipment.destination.street}
                    {shipment.destination.colonia ? `, ${shipment.destination.colonia}` : ''}
                  </p>
                  <p className="text-xs text-gray-600">
                    {shipment.destination.city}, {shipment.destination.state} {shipment.destination.zip}
                  </p>
                  {shipment.destination.references && (
                    <p className="text-xs text-gray-400 mt-1">Ref: {shipment.destination.references}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Detalles del paquete */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-gray-700">Detalles del paquete</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Tipo</p>
                <p className="font-medium">{PACKAGE_TYPES[shipment.packageType]}</p>
              </div>
              <div>
                <p className="text-gray-500">Servicio</p>
                <p className="font-medium">{SERVICE_TYPES[shipment.serviceType]}</p>
              </div>
              <div>
                <p className="text-gray-500">Peso</p>
                <p className="font-medium">{shipment.weight ? `${shipment.weight} kg` : '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Piezas</p>
                <p className="font-medium">{shipment.pieces}</p>
              </div>
              {shipment.description && (
                <div className="col-span-2">
                  <p className="text-gray-500">Descripción</p>
                  <p className="font-medium">{shipment.description}</p>
                </div>
              )}
              {shipment.declaredValue && (
                <div>
                  <p className="text-gray-500">Valor declarado</p>
                  <p className="font-medium">${shipment.declaredValue} USD</p>
                </div>
              )}
              {shipment.notes && (
                <div className="col-span-4">
                  <p className="text-gray-500">Notas internas</p>
                  <p className="text-gray-700 bg-gray-50 rounded p-2 text-xs">{shipment.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline de tracking */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-sm text-gray-700">Historial de tracking</h3>
            </div>
            <div className="space-y-4">
              {[...shipment.events].reverse().map((event: any, i: number, arr: any[]) => {
                const Icon = STATUS_ICONS[event.status] ?? Package
                const isLast = i === arr.length - 1
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                        i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-4" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {STATUS_LABELS[event.status] ?? event.status}
                      </p>
                      <p className="text-xs text-gray-500">{event.description}</p>
                      {event.location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {event.location}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.createdAt).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal cambio de estado */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">Actualizar estado</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Nuevo estado *</label>
                <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {nextStatuses.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Ubicación</label>
                <input className="input" placeholder="Ej: CDMX, Guadalajara..." value={statusLocation} onChange={e => setStatusLocation(e.target.value)} />
              </div>
              <div>
                <label className="label">Nota adicional</label>
                <textarea className="input resize-none" rows={2} value={statusNote} onChange={e => setStatusNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowStatusModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary flex-1"
                onClick={updateStatus}
                disabled={!newStatus || updating}
              >
                {updating ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
