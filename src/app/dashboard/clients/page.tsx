'use client'
import { useEffect, useState, useCallback } from 'react'
import { Users, Plus, Search, Edit2, Trash2, X, Phone, Mail, MapPin } from 'lucide-react'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

const STATES_US = ['California','Texas','Florida','New York','Arizona','Nevada','Illinois','Washington']

const empty = { name: '', phone: '', email: '', street: '', city: '', state: '', zip: '', notes: '' }

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/clients${params}`)
    const data = await res.json()
    setClients(data.clients ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchClients() }, [fetchClients])

  function openNew() {
    setEditing(null)
    setForm({ ...empty })
    setError('')
    setShowModal(true)
  }

  function openEdit(client: any) {
    setEditing(client)
    setForm({
      name: client.name ?? '', phone: client.phone ?? '', email: client.email ?? '',
      street: client.street ?? '', city: client.city ?? '', state: client.state ?? '',
      zip: client.zip ?? '', notes: client.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')
    const res = editing
      ? await fetch(`/api/clients/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      : await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false)
    if (!res.ok) { setError('Error al guardar. Intenta de nuevo.'); return }
    setShowModal(false)
    fetchClients()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cliente?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    fetchClients()
  }

  const u = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))
  const inp = (field: string, props?: any) => (
    <input className="input !py-1.5 !text-sm" value={(form as any)[field]} onChange={e => u(field, e.target.value)} {...props} />
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">Directorio de remitentes frecuentes</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, teléfono o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : clients.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mx-auto mb-3">
            <Users className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No hay clientes registrados</p>
          <p className="text-sm text-gray-400 mt-1">Agrega remitentes frecuentes para agilizar la captura de envíos</p>
          <button className="btn-primary mt-4" onClick={openNew}>
            <Plus className="w-4 h-4" /> Agregar primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(c => (
            <div key={c.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    {c.city && <p className="text-xs text-gray-400">{c.city}{c.state ? `, ${c.state}` : ''}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {c.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {c.phone}
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {c.email}
                  </div>
                )}
                {c.street && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    {c.street}
                  </div>
                )}
                {c.notes && (
                  <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 mt-2">{c.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                {inp('name', { placeholder: 'Nombre completo', required: true })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  {inp('phone', { type: 'tel', placeholder: '+1 555 000 0000' })}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  {inp('email', { type: 'email' })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Calle y número</label>
                <AddressAutocomplete
                  country="us"
                  className="input !py-1.5 !text-sm"
                  placeholder="Escribe para buscar..."
                  value={form.street}
                  onChange={v => u('street', v)}
                  onSelect={r => setForm(f => ({ ...f, street: r.street, city: r.city, state: r.state, zip: r.zip }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad</label>
                  {inp('city')}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select className="input !py-1.5 !text-sm" value={form.state} onChange={e => u('state', e.target.value)}>
                    <option value="">Seleccionar</option>
                    {STATES_US.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
                {inp('zip')}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea className="input !py-1.5 !text-sm resize-none" rows={2} value={form.notes} onChange={e => u('notes', e.target.value)} />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
