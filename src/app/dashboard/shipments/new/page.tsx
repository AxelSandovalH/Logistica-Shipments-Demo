'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, User, MapPin, ArrowLeft, CheckCircle, BookUser, X, Search } from 'lucide-react'
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

export default function NewShipmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [clientSearch, setClientSearch] = useState('')

  const [form, setForm] = useState({
    senderName: '', senderPhone: '', senderEmail: '',
    originStreet: '', originCity: '', originState: '', originZip: '',
    recipientName: '', recipientPhone: '', recipientEmail: '',
    destStreet: '', destColonia: '', destCity: '', destState: '', destZip: '', destReferences: '',
    weight: '', packageType: 'PACKAGE', description: '', pieces: '1',
    declaredValue: '', serviceType: 'STANDARD', notes: '',
  })

  useEffect(() => {
    if (!showClientPicker) return
    fetch(`/api/clients${clientSearch ? `?search=${encodeURIComponent(clientSearch)}` : ''}`)
      .then(r => r.json()).then(d => setClients(d.clients ?? []))
  }, [showClientPicker, clientSearch])

  const u = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))
  const inp = (field: string, props?: any) => (
    <input className="input !py-1.5 !text-sm" value={(form as any)[field]} onChange={e => u(field, e.target.value)} {...props} />
  )

  function selectClient(c: any) {
    setForm(f => ({
      ...f,
      senderName: c.name ?? '',
      senderPhone: c.phone ?? '',
      senderEmail: c.email ?? '',
      originStreet: c.street ?? '',
      originCity: c.city ?? '',
      originState: c.state ?? '',
      originZip: c.zip ?? '',
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
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError('Error al crear el envío. Verifica los datos.'); return }
    setSuccess(data.shipment.guideNumber)
  }

  if (success) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="card max-w-sm w-full text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">¡Envío creado!</h2>
          <p className="text-sm text-gray-500 mb-3">Número de guía generado:</p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 font-mono text-base font-bold text-blue-700 mb-5">
            {success}
          </div>
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => setSuccess(null)}>Crear otro</button>
            <button className="btn-primary" onClick={() => router.push('/dashboard/shipments')}>Ver envíos</button>
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
          <p className="text-xs text-gray-500">Completa los datos para generar la guía</p>
        </div>
        <div className="ml-auto flex gap-2">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-1.5">{error}</p>}
          <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => router.back()}>Cancelar</button>
          <button form="shipment-form" type="submit" className="btn-primary !py-1.5 !text-xs" disabled={loading}>
            {loading ? 'Creando...' : 'Generar guía'}
          </button>
        </div>
      </div>

      {/* Form */}
      <form id="shipment-form" onSubmit={handleSubmit} className="flex-1 grid grid-cols-3 gap-4 p-5 overflow-auto">

        {/* Remitente */}
        <div className="card !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-800">Remitente <span className="text-gray-400 font-normal">(EE.UU.)</span></h2>
            </div>
            <button
              type="button"
              onClick={() => setShowClientPicker(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <BookUser className="w-3.5 h-3.5" />
              Directorio
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <F label="Nombre *" span={2}>{inp('senderName', { required: true })}</F>
            <F label="Teléfono">{inp('senderPhone', { type: 'tel' })}</F>
            <F label="Email">{inp('senderEmail', { type: 'email' })}</F>
            <F label="Calle y número" span={2}>
              <AddressAutocomplete
                country="us"
                className="input !py-1.5 !text-sm"
                placeholder="Escribe para buscar..."
                value={form.originStreet}
                onChange={v => u('originStreet', v)}
                onSelect={r => setForm(f => ({ ...f, originStreet: r.street, originCity: r.city, originState: r.state, originZip: r.zip }))}
              />
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

        {/* Destinatario */}
        <div className="card !p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-green-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Destinatario <span className="text-gray-400 font-normal">(México)</span></h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <F label="Nombre *" span={2}>{inp('recipientName', { required: true })}</F>
            <F label="Teléfono">{inp('recipientPhone', { type: 'tel' })}</F>
            <F label="Email">{inp('recipientEmail', { type: 'email' })}</F>
            <F label="Calle y número" span={2}>
              <AddressAutocomplete
                country="mx"
                className="input !py-1.5 !text-sm"
                placeholder="Escribe para buscar..."
                value={form.destStreet}
                onChange={v => u('destStreet', v)}
                onSelect={r => setForm(f => ({ ...f, destStreet: r.street, destColonia: r.colonia ?? f.destColonia, destCity: r.city, destState: r.state, destZip: r.zip }))}
              />
            </F>
            <F label="Colonia">{inp('destColonia')}</F>
            <F label="Ciudad *">{inp('destCity', { required: true })}</F>
            <F label="Estado *">
              <select className="input !py-1.5 !text-sm" value={form.destState} onChange={e => u('destState', e.target.value)} required>
                <option value="">Seleccionar</option>
                {STATES_MX.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </F>
            <F label="C.P.">{inp('destZip')}</F>
            <F label="Referencias" span={2}>{inp('destReferences', { placeholder: 'Entre calles, color de casa...' })}</F>
          </div>
        </div>

        {/* Paquete */}
        <div className="card !p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Paquete</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <F label="Tipo">
              <select className="input !py-1.5 !text-sm" value={form.packageType} onChange={e => u('packageType', e.target.value)}>
                <option value="PACKAGE">Paquete</option>
                <option value="ENVELOPE">Sobre</option>
                <option value="PALLET">Tarima</option>
              </select>
            </F>
            <F label="Servicio">
              <select className="input !py-1.5 !text-sm" value={form.serviceType} onChange={e => u('serviceType', e.target.value)}>
                <option value="STANDARD">Estándar</option>
                <option value="EXPRESS">Express</option>
                <option value="ECONOMY">Económico</option>
              </select>
            </F>
            <F label="Peso (kg)">{inp('weight', { type: 'number', step: '0.1', min: '0' })}</F>
            <F label="Piezas">{inp('pieces', { type: 'number', min: '1' })}</F>
            <F label="Valor declarado (USD)" span={2}>{inp('declaredValue', { type: 'number', step: '0.01', min: '0' })}</F>
            <F label="Descripción del contenido" span={2}>{inp('description')}</F>
            <F label="Notas internas" span={2}>
              <textarea
                className="input !py-1.5 !text-sm resize-none"
                rows={3}
                value={form.notes}
                onChange={e => u('notes', e.target.value)}
              />
            </F>
          </div>
        </div>

      </form>

      {/* Modal directorio de clientes */}
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
                <input
                  className="input pl-9 !py-1.5 !text-sm"
                  placeholder="Buscar cliente..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-gray-50">
              {clients.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">
                  {clientSearch ? 'Sin resultados' : 'No hay clientes registrados'}
                </div>
              ) : (
                clients.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectClient(c)}
                    className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {[c.phone, c.city, c.state].filter(Boolean).join(' · ')}
                    </p>
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
