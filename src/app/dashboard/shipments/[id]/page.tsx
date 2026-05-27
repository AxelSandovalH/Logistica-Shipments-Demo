'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, Package, User, Clock, CheckCircle,
  TruckIcon, AlertCircle, RotateCcw, ExternalLink, Printer, Pencil, X, UserCheck,
} from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS, PACKAGE_TYPES, SERVICE_TYPES, getStatusLabel } from '@/lib/utils'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

const STATUS_ICONS: Record<string, React.ElementType> = {
  RECEIVED: Package, IN_TRANSIT: TruckIcon, OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle, FAILED: AlertCircle, RETURNED: RotateCcw,
}

const NEXT_STATUSES: Record<string, string[]> = {
  RECEIVED: ['IN_TRANSIT'], IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'], DELIVERED: [], FAILED: ['OUT_FOR_DELIVERY', 'RETURNED'], RETURNED: [],
}

const STATES_MX = ['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas']
const STATES_US = ['California','Texas','Florida','New York','Arizona','Nevada','Illinois','Washington']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function ShipmentDetailPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [shipment, setShipment]         = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [updating, setUpdating]         = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showEditModal, setShowEditModal]     = useState(false)
  const [newStatus, setNewStatus]       = useState('')
  const [statusNote, setStatusNote]     = useState('')
  const [statusLocation, setStatusLocation] = useState('')
  const [editForm, setEditForm]         = useState<any>({})
  const [saving, setSaving]             = useState(false)
  const [drivers, setDrivers]           = useState<any[]>([])
  const [assigningDriver, setAssigningDriver] = useState(false)

  async function fetchShipment() {
    const res = await fetch(`/api/shipments/${id}`)
    if (res.ok) { const data = await res.json(); setShipment(data.shipment) }
    setLoading(false)
  }

  useEffect(() => { fetchShipment() }, [id])

  // ── Realtime auto-refresh ─────────────────────────────────────────────────
  useRealtimeRefresh('Shipment', fetchShipment)
  useRealtimeRefresh('TrackingEvent', fetchShipment)
  useEffect(() => {
    fetch('/api/drivers').then(r => r.json()).then(d => setDrivers(d.drivers ?? []))
  }, [])

  async function assignDriver(driverId: string | null) {
    setAssigningDriver(true)
    await fetch(`/api/shipments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _assign: true, assignedDriverId: driverId }),
    })
    setAssigningDriver(false)
    fetchShipment()
  }

  function openEdit() {
    if (!shipment) return
    setEditForm({
      senderName:     shipment.senderName ?? '',
      senderPhone:    shipment.senderPhone ?? '',
      senderEmail:    shipment.senderEmail ?? '',
      recipientName:  shipment.recipientName ?? '',
      recipientPhone: shipment.recipientPhone ?? '',
      recipientEmail: shipment.recipientEmail ?? '',
      notifyRecipient: shipment.notifyRecipient ?? false,
      weight:         shipment.weight ?? '',
      pieces:         shipment.pieces ?? 1,
      packageType:    shipment.packageType ?? 'PACKAGE',
      serviceType:    shipment.serviceType ?? 'STANDARD',
      description:    shipment.description ?? '',
      declaredValue:  shipment.declaredValue ?? '',
      notes:          shipment.notes ?? '',
      destStreet:     shipment.destination?.street ?? '',
      destColonia:    shipment.destination?.colonia ?? '',
      destCity:       shipment.destination?.city ?? '',
      destState:      shipment.destination?.state ?? '',
      destZip:        shipment.destination?.zip ?? '',
      destReferences: shipment.destination?.references ?? '',
    })
    setShowEditModal(true)
  }

  async function saveEdit() {
    setSaving(true)
    await fetch(`/api/shipments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _edit: true, ...editForm }),
    })
    setShowEditModal(false)
    await fetchShipment()
    setSaving(false)
  }

  async function updateStatus() {
    setUpdating(true)
    await fetch(`/api/shipments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, description: statusNote || undefined, location: statusLocation || undefined }),
    })
    setShowStatusModal(false); setStatusNote(''); setStatusLocation('')
    await fetchShipment(); setUpdating(false)
  }

  const uf = (f: string, v: any) => setEditForm((p: any) => ({ ...p, [f]: v }))
  const inp = (f: string, props?: any) => (
    <input className="input !py-1.5 !text-sm" autoComplete="off" value={editForm[f] ?? ''} onChange={e => uf(f, e.target.value)} {...props} />
  )

  if (loading) return <div className="p-8 text-gray-400">Cargando...</div>
  if (!shipment) return <div className="p-8 text-gray-400">Envío no encontrado</div>

  const nextStatuses = NEXT_STATUSES[shipment.status] ?? []

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="btn-secondary !px-2 !py-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono text-gray-900">{shipment.guideNumber}</h1>
            <span className={`badge ${STATUS_COLORS[shipment.status]}`}>{getStatusLabel(shipment.status, shipment.events)}</span>
          </div>
          <p className="text-sm text-gray-500">Agencia: {shipment.agency?.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={openEdit} className="btn-secondary text-xs">
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <a href={`/track/${shipment.guideNumber}`} target="_blank" className="btn-secondary text-xs">
            <ExternalLink className="w-3 h-3" /> Tracking
          </a>
          <a href={`/dashboard/shipments/${shipment.id}/print`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-3 h-3" /> Imprimir
          </a>
          {nextStatuses.length > 0 && (
            <button className="btn-primary" onClick={() => setShowStatusModal(true)}>Actualizar estado</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm text-gray-700">Remitente (EE.UU.)</h3>
              </div>
              <p className="font-medium text-gray-900">{shipment.senderName}</p>
              {shipment.senderPhone && <p className="text-sm text-gray-500">{shipment.senderPhone}</p>}
              {shipment.senderEmail && <p className="text-sm text-gray-500">{shipment.senderEmail}</p>}
              {shipment.origin && <p className="text-xs text-gray-400 mt-2">{shipment.origin.street}, {shipment.origin.city}, {shipment.origin.state}</p>}
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
                  <p className="text-xs text-gray-600">{shipment.destination.street}{shipment.destination.colonia ? `, ${shipment.destination.colonia}` : ''}</p>
                  <p className="text-xs text-gray-600">{shipment.destination.city}, {shipment.destination.state} {shipment.destination.zip}</p>
                  {shipment.destination.references && <p className="text-xs text-gray-400 mt-1">Ref: {shipment.destination.references}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Asignar chofer */}
          {drivers.length > 0 && (
            <div className="card !p-4 flex items-center gap-3">
              <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-sm font-medium text-gray-700 shrink-0">Chofer asignado:</p>
              <select
                className="input !py-1.5 !text-sm flex-1"
                value={shipment.assignedDriverId ?? ''}
                onChange={e => assignDriver(e.target.value || null)}
                disabled={assigningDriver}
              >
                <option value="">Sin asignar</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-gray-700">Detalles del paquete</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-gray-500">Tipo</p><p className="font-medium">{PACKAGE_TYPES[shipment.packageType]}</p></div>
              <div><p className="text-gray-500">Servicio</p><p className="font-medium">{SERVICE_TYPES[shipment.serviceType]}</p></div>
              <div><p className="text-gray-500">Peso</p><p className="font-medium">{shipment.weight ? `${shipment.weight} kg` : '—'}</p></div>
              <div><p className="text-gray-500">Piezas</p><p className="font-medium">{shipment.pieces}</p></div>
              {shipment.description && <div className="col-span-2"><p className="text-gray-500">Descripción</p><p className="font-medium">{shipment.description}</p></div>}
              {shipment.declaredValue && <div><p className="text-gray-500">Valor declarado</p><p className="font-medium">${shipment.declaredValue} USD</p></div>}
              {shipment.notes && <div className="col-span-4"><p className="text-gray-500">Notas internas</p><p className="text-gray-700 bg-gray-50 rounded p-2 text-xs">{shipment.notes}</p></div>}
            </div>
          </div>
        </div>

        {/* PoD Card — only when delivered */}
        <div className="space-y-4">
          {shipment.status === 'DELIVERED' && (() => {
            const deliveryEvent = [...shipment.events].reverse().find((e: any) => e.status === 'DELIVERED')
            if (!deliveryEvent) return null
            const hasEvidence = deliveryEvent.photoUrl || deliveryEvent.signatureUrl
            return (
              <div className="card border-2 border-emerald-200 bg-emerald-50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Comprobante de entrega (PoD)</p>
                    <p className="text-xs text-emerald-600">
                      {new Date(deliveryEvent.createdAt).toLocaleString('es-MX', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {hasEvidence ? (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {deliveryEvent.photoUrl && (
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Foto de evidencia</p>
                        <a href={deliveryEvent.photoUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={deliveryEvent.photoUrl}
                            alt="Evidencia"
                            className="rounded-xl w-full object-cover border-2 border-emerald-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                            style={{ maxHeight: '160px' }}
                          />
                        </a>
                      </div>
                    )}
                    {deliveryEvent.signatureUrl && (
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Firma del cliente</p>
                        <a href={deliveryEvent.signatureUrl} target="_blank" rel="noopener noreferrer">
                          <div className="rounded-xl border-2 border-emerald-200 bg-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-zoom-in" style={{ maxHeight: '160px', minHeight: '80px' }}>
                            <img
                              src={deliveryEvent.signatureUrl}
                              alt="Firma"
                              className="w-full h-full object-contain p-2"
                              style={{ maxHeight: '156px' }}
                            />
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 italic mt-1">Sin foto ni firma registrada en esta entrega.</p>
                )}

                {deliveryEvent.description && (
                  <p className="text-xs text-emerald-700 mt-2 bg-emerald-100 rounded-lg px-3 py-2">
                    {deliveryEvent.description}
                  </p>
                )}

                {shipment.assignedDriver && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <TruckIcon className="w-3 h-3" />
                    Entregó: <span className="font-semibold">{shipment.assignedDriver.name}</span>
                  </p>
                )}
              </div>
            )
          })()}

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-sm text-gray-700">Historial de tracking</h3>
            </div>
            <div className="space-y-4">
              {[...shipment.events].reverse().map((event: any, i: number, arr: any[]) => {
                const Icon = STATUS_ICONS[event.status] ?? Package
                return (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-4" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{getStatusLabel(event.status, [event])}</p>
                      <p className="text-xs text-gray-500">{event.description}</p>
                      {event.location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{event.location}</p>}
                      {event.photoUrl && (
                        <a href={event.photoUrl} target="_blank" className="mt-1 block">
                          <img src={event.photoUrl} alt="Evidencia" className="rounded-lg w-full max-w-[180px] border border-gray-200 hover:opacity-90 transition-opacity" />
                        </a>
                      )}
                      {event.signatureUrl && (
                        <div className="mt-1">
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Firma</p>
                          <a href={event.signatureUrl} target="_blank">
                            <img src={event.signatureUrl} alt="Firma" className="rounded-lg border border-gray-200 bg-white hover:opacity-90 transition-opacity" style={{ maxWidth: '160px', maxHeight: '60px', objectFit: 'contain' }} />
                          </a>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.createdAt).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal editar */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Editar guía · <span className="font-mono text-blue-700">{shipment.guideNumber}</span></h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">

              {/* Remitente */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Remitente</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre *"><input className="input !py-1.5 !text-sm" autoComplete="off" value={editForm.senderName} onChange={e => uf('senderName', e.target.value)} /></Field>
                  <Field label="Teléfono">{inp('senderPhone', { type: 'tel' })}</Field>
                  <Field label="Email" ><input className="input !py-1.5 !text-sm col-span-2" autoComplete="off" value={editForm.senderEmail} onChange={e => uf('senderEmail', e.target.value)} type="email" /></Field>
                </div>
              </div>

              {/* Destinatario */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Destinatario</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre *"><input className="input !py-1.5 !text-sm" autoComplete="off" value={editForm.recipientName} onChange={e => uf('recipientName', e.target.value)} /></Field>
                  <Field label="Teléfono">{inp('recipientPhone', { type: 'tel' })}</Field>
                  <Field label="Email">{inp('recipientEmail', { type: 'email' })}</Field>
                  <div className="flex items-center gap-2 col-span-2 py-1">
                    <input type="checkbox" id="editNotify" checked={editForm.notifyRecipient} onChange={e => uf('notifyRecipient', e.target.checked)} className="rounded border-gray-300 text-blue-600 w-4 h-4" />
                    <label htmlFor="editNotify" className="text-xs text-gray-600">Notificar al destinatario por email</label>
                  </div>
                  <div className="col-span-2"><Field label="Calle"><input className="input !py-1.5 !text-sm w-full" autoComplete="off" value={editForm.destStreet} onChange={e => uf('destStreet', e.target.value)} /></Field></div>
                  <Field label="Colonia">{inp('destColonia')}</Field>
                  <Field label="Ciudad">{inp('destCity')}</Field>
                  <Field label="Estado">
                    <select className="input !py-1.5 !text-sm" value={editForm.destState} onChange={e => uf('destState', e.target.value)}>
                      <option value="">Seleccionar</option>
                      {STATES_MX.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="C.P.">{inp('destZip')}</Field>
                  <Field label="Referencias"><input className="input !py-1.5 !text-sm w-full" autoComplete="off" value={editForm.destReferences} onChange={e => uf('destReferences', e.target.value)} /></Field>
                </div>
              </div>

              {/* Paquete */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Paquete</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo">
                    <select className="input !py-1.5 !text-sm" value={editForm.packageType} onChange={e => uf('packageType', e.target.value)}>
                      <option value="PACKAGE">Paquete</option>
                      <option value="ENVELOPE">Sobre</option>
                      <option value="PALLET">Tarima</option>
                    </select>
                  </Field>
                  <Field label="Servicio">
                    <select className="input !py-1.5 !text-sm" value={editForm.serviceType} onChange={e => uf('serviceType', e.target.value)}>
                      <option value="STANDARD">Estándar</option>
                      <option value="EXPRESS">Express</option>
                      <option value="ECONOMY">Económico</option>
                    </select>
                  </Field>
                  <Field label="Peso (kg)">{inp('weight', { type: 'number', step: '0.1', min: '0' })}</Field>
                  <Field label="Piezas">{inp('pieces', { type: 'number', min: '1' })}</Field>
                  <Field label="Valor declarado (USD)">{inp('declaredValue', { type: 'number', step: '0.01', min: '0' })}</Field>
                  <Field label="Descripción">{inp('description')}</Field>
                  <Field label="Notas internas">
                    <textarea className="input !py-1.5 !text-sm resize-none w-full" rows={2} value={editForm.notes} onChange={e => uf('notes', e.target.value)} autoComplete="off" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button className="btn-secondary flex-1" onClick={() => setShowEditModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {nextStatuses.map((s: string) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
              <button className="btn-secondary flex-1" onClick={() => setShowStatusModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={updateStatus} disabled={!newStatus || updating}>
                {updating ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
