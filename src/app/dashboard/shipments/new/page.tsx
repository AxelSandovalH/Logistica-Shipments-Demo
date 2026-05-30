'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, User, MapPin, ArrowLeft, CheckCircle, BookUser, X, Search, Plus, Trash2 } from 'lucide-react'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

const STATES_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México',
  'Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
]
const STATES_US = ['California','Texas','Florida','New York','Arizona','Nevada','Illinois','Washington']

const F = ({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) => (
  <div className={span > 1 ? `col-span-${span}` : ''}>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    {children}
  </div>
)

const emptyRecipient = () => ({
  recipientName: '', recipientPhone: '', recipientEmail: '',
  notifyRecipient: false,
  packageType: 'PACKAGE', weight: '', pieces: '1', description: '', declaredValue: '',
  destStreet: '', destColonia: '', destCity: '', destState: '', destZip: '', destReferences: '',
})

export default function NewShipmentPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState<string[] | null>(null)
  const [error, setError]       = useState('')
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clients, setClients]   = useState<any[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [agencies, setAgencies] = useState<any[]>([])

  // Sender + service (shared for all recipients)
  const [form, setForm] = useState({
    agencyId: '',
    senderName: '', senderPhone: '', senderEmail: '',
    originStreet: '', originCity: '', originState: '', originZip: '',
    serviceType: 'STANDARD', notes: '',
  })

  // Multiple recipients
  const [recipients, setRecipients] = useState([emptyRecipient()])

  useEffect(() => {
    fetch('/api/agencies')
      .then(r => r.ok ? r.json() : { agencies: [] })
      .then(d => setAgencies(d.agencies ?? []))
  }, [])

  useEffect(() => {
    if (!showClientPicker) return
    const agencyParam = form.agencyId ? `&agencyId=${form.agencyId}` : ''
    fetch(`/api/clients${clientSearch ? `?search=${encodeURIComponent(clientSearch)}${agencyParam}` : form.agencyId ? `?agencyId=${form.agencyId}` : ''}`)
      .then(r => r.json()).then(d => setClients(d.clients ?? []))
  }, [showClientPicker, clientSearch, form.agencyId])

  const u = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))
  const inp = (field: string, props?: any) => (
    <input className="input !py-1.5 !text-sm" value={(form as any)[field]} onChange={e => u(field, e.target.value)} autoComplete="off" {...props} />
  )

  function updateRecipient(idx: number, field: string, value: any) {
    setRecipients(rs => rs.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
  function addRecipient() { setRecipients(rs => [...rs, emptyRecipient()]) }
  function removeRecipient(idx: number) { setRecipients(rs => rs.filter((_, i) => i !== idx)) }

  function selectClient(c: any) {
    setForm(f => ({
      ...f,
      senderName: c.name ?? '', senderPhone: c.phone ?? '', senderEmail: c.email ?? '',
      originStreet: c.street ?? '', originCity: c.city ?? '', originState: c.state ?? '', originZip: c.zip ?? '',
    }))
    setShowClientPicker(false)
    setClientSearch('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, recipients }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Error al crear el envío.'); return }
    // Single or multiple guide numbers
    if (data.guideNumbers) setSuccess(data.guideNumbers)
    else setSuccess([data.shipment.guideNumber])
  }

  if (success) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card max-w-sm w-full text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            {success.length === 1 ? '¡Envío creado!' : `¡${success.length} envíos creados!`}
          </h2>
          <div className="space-y-2 my-4">
            {success.map(g => (
              <div key={g} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-sm font-bold text-blue-700">{g}</span>
                <a href={`/print/${g}`} target="_blank" className="text-xs text-blue-600 hover:underline font-medium">
                  Imprimir →
                </a>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setSuccess(null)}>Crear otro</button>
            <button className="btn-secondary flex-1" onClick={() => router.push('/dashboard/shipments')}>Ver envíos</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white">
        <button onClick={() => router.back()} className="btn-secondary !px-2 !py-1.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Nuevo Envío</h1>
          <p className="text-xs text-gray-500">
            {recipients.length === 1 ? 'Un destinatario' : `${recipients.length} destinatarios`}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-1.5">{error}</p>}
          <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => router.back()}>Cancelar</button>
          <button form="shipment-form" type="submit" className="btn-primary !py-1.5 !text-xs" disabled={loading}>
            {loading ? 'Creando...' : recipients.length === 1 ? 'Generar guía' : `Generar ${recipients.length} guías`}
          </button>
        </div>
      </div>

      <form id="shipment-form" onSubmit={handleSubmit} autoComplete="off" className="flex-1 overflow-auto p-4 md:p-5 space-y-4">

        {/* Agencia (solo ADMIN) */}
        {agencies.length > 0 && (
          <div className="card !p-4 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 whitespace-nowrap">
              <div className="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-orange-600" />
              </div>
              Agencia *
            </div>
            <select className="input !py-1.5 !text-sm flex-1" value={form.agencyId} onChange={e => u('agencyId', e.target.value)} required>
              <option value="">Seleccionar agencia...</option>
              {agencies.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Remitente */}
          <div className="card !p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Remitente <span className="text-gray-400 font-normal">(EE.UU.)</span></h2>
              </div>
              <button type="button" onClick={() => setShowClientPicker(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                <BookUser className="w-3.5 h-3.5" /> Directorio
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <F label="Nombre *" span={2}>{inp('senderName', { required: true })}</F>
              <F label="Teléfono">{inp('senderPhone', { type: 'tel' })}</F>
              <F label="Email">{inp('senderEmail', { type: 'email' })}</F>
              <F label="Calle y número" span={2}>
                <AddressAutocomplete country="us" className="input !py-1.5 !text-sm" placeholder="Escribe para buscar..."
                  value={form.originStreet} onChange={v => u('originStreet', v)}
                  onSelect={r => setForm(f => ({ ...f, originStreet: r.street, originCity: r.city, originState: r.state, originZip: r.zip }))} />
              </F>
              <F label="Ciudad">{inp('originCity')}</F>
              <F label="Estado">
                <select className="input !py-1.5 !text-sm" value={form.originState} onChange={e => u('originState', e.target.value)}>
                  <option value="">Seleccionar</option>
                  {STATES_US.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
              <F label="ZIP">{inp('originZip')}</F>
            </div>
          </div>

          {/* Servicio (compartido) */}
          <div className="card !p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-800">Servicio <span className="text-gray-400 font-normal text-xs">(aplica a todos)</span></h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <F label="Tipo de servicio" span={2}>
                <select className="input !py-1.5 !text-sm" value={form.serviceType} onChange={e => u('serviceType', e.target.value)}>
                  <option value="STANDARD">Estándar</option>
                  <option value="EXPRESS">Express</option>
                  <option value="ECONOMY">Económico</option>
                </select>
              </F>
              <F label="Notas internas" span={2}>
                <textarea className="input !py-1.5 !text-sm resize-none" rows={3} value={form.notes} onChange={e => u('notes', e.target.value)} autoComplete="off" />
              </F>
            </div>
          </div>
        </div>

        {/* Destinatarios */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-green-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-800">
                Destinatarios <span className="text-gray-400 font-normal">(México)</span>
                <span className="ml-2 text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{recipients.length}</span>
              </h2>
            </div>
            <button type="button" onClick={addRecipient} className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Agregar destinatario
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipients.map((rec, idx) => (
              <div key={idx} className="card !p-4 relative">
                {/* Number badge */}
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-black flex items-center justify-center shadow">
                  {idx + 1}
                </div>
                {recipients.length > 1 && (
                  <button type="button" onClick={() => removeRecipient(idx)} className="absolute top-3 right-3 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2.5 mt-1">
                  <F label="Nombre *" span={2}>
                    <input className="input !py-1.5 !text-sm" required value={rec.recipientName}
                      onChange={e => updateRecipient(idx, 'recipientName', e.target.value)} autoComplete="off" />
                  </F>
                  <F label="Teléfono">
                    <input className="input !py-1.5 !text-sm" type="tel" value={rec.recipientPhone}
                      onChange={e => updateRecipient(idx, 'recipientPhone', e.target.value)} autoComplete="off" />
                  </F>
                  <F label="Email">
                    <input className="input !py-1.5 !text-sm" type="email" value={rec.recipientEmail}
                      onChange={e => updateRecipient(idx, 'recipientEmail', e.target.value)} autoComplete="off" />
                  </F>
                  <div className="col-span-2 flex items-center gap-2 py-0.5">
                    <input type="checkbox" id={`notify-${idx}`} checked={rec.notifyRecipient}
                      onChange={e => updateRecipient(idx, 'notifyRecipient', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 w-4 h-4 cursor-pointer" />
                    <label htmlFor={`notify-${idx}`} className="text-xs text-gray-600 cursor-pointer select-none">
                      Notificar por email
                    </label>
                  </div>
                  <F label="Calle y número *" span={2}>
                    <AddressAutocomplete country="mx" className="input !py-1.5 !text-sm" placeholder="Escribe para buscar..."
                      value={rec.destStreet} onChange={v => updateRecipient(idx, 'destStreet', v)}
                      onSelect={r => setRecipients(rs => rs.map((x, i) => i === idx
                        ? { ...x, destStreet: r.street, destColonia: r.colonia ?? x.destColonia, destCity: r.city, destState: r.state, destZip: r.zip }
                        : x
                      ))} />
                  </F>
                  <F label="Colonia">
                    <input className="input !py-1.5 !text-sm" value={rec.destColonia}
                      onChange={e => updateRecipient(idx, 'destColonia', e.target.value)} autoComplete="off" />
                  </F>
                  <F label="Ciudad *">
                    <input className="input !py-1.5 !text-sm" required value={rec.destCity}
                      onChange={e => updateRecipient(idx, 'destCity', e.target.value)} autoComplete="off" />
                  </F>
                  <F label="Estado *">
                    <select className="input !py-1.5 !text-sm" required value={rec.destState}
                      onChange={e => updateRecipient(idx, 'destState', e.target.value)}>
                      <option value="">Seleccionar</option>
                      {STATES_MX.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </F>
                  <F label="C.P.">
                    <input className="input !py-1.5 !text-sm" value={rec.destZip}
                      onChange={e => updateRecipient(idx, 'destZip', e.target.value)} autoComplete="off" />
                  </F>
                  <F label="Referencias" span={2}>
                    <input className="input !py-1.5 !text-sm" placeholder="Entre calles, color de casa..." value={rec.destReferences}
                      onChange={e => updateRecipient(idx, 'destReferences', e.target.value)} autoComplete="off" />
                  </F>

                  {/* Paquete — específico por destinatario */}
                  <div className="col-span-2 border-t border-gray-100 pt-2.5 mt-0.5">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Detalles del paquete</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <F label="Tipo">
                        <select className="input !py-1.5 !text-sm" value={rec.packageType}
                          onChange={e => updateRecipient(idx, 'packageType', e.target.value)}>
                          <option value="PACKAGE">Paquete</option>
                          <option value="ENVELOPE">Sobre</option>
                          <option value="PALLET">Tarima</option>
                        </select>
                      </F>
                      <F label="Piezas">
                        <input className="input !py-1.5 !text-sm" type="number" min="1" value={rec.pieces}
                          onChange={e => updateRecipient(idx, 'pieces', e.target.value)} autoComplete="off" />
                      </F>
                      <F label="Peso (kg)">
                        <input className="input !py-1.5 !text-sm" type="number" step="0.1" min="0" value={rec.weight}
                          onChange={e => updateRecipient(idx, 'weight', e.target.value)} autoComplete="off" />
                      </F>
                      <F label="Valor declarado (USD)">
                        <input className="input !py-1.5 !text-sm" type="number" step="0.01" min="0" value={rec.declaredValue}
                          onChange={e => updateRecipient(idx, 'declaredValue', e.target.value)} autoComplete="off" />
                      </F>
                      <F label="Descripción del contenido" span={2}>
                        <input className="input !py-1.5 !text-sm" value={rec.description}
                          onChange={e => updateRecipient(idx, 'description', e.target.value)} autoComplete="off" />
                      </F>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add card */}
            <button type="button" onClick={addRecipient}
              className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 py-10 text-gray-400 hover:border-green-300 hover:text-green-500 transition-colors min-h-[120px]">
              <Plus className="w-6 h-6" />
              <span className="text-sm font-medium">Agregar destinatario</span>
            </button>
          </div>
        </div>

      </form>

      {/* Modal directorio */}
      {showClientPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Seleccionar remitente</h2>
              <button onClick={() => { setShowClientPicker(false); setClientSearch('') }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="input pl-9 !py-1.5 !text-sm" placeholder="Buscar cliente..." value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)} autoComplete="off" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-gray-50">
              {clients.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">
                  {clientSearch ? 'Sin resultados' : 'No hay clientes registrados'}
                </div>
              ) : (
                clients.map(c => (
                  <button key={c.id} type="button" onClick={() => selectClient(c)} className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors">
                    <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-400">{[c.phone, c.city, c.state].filter(Boolean).join(' · ')}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
