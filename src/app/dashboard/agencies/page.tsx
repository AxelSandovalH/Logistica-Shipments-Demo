'use client'
import { useEffect, useState } from 'react'
import { Building2, Plus, Package, Users } from 'lucide-react'

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', code: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchAgencies() {
    const res = await fetch('/api/agencies')
    if (res.ok) {
      const data = await res.json()
      setAgencies(data.agencies)
    }
    setLoading(false)
  }

  useEffect(() => { fetchAgencies() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/agencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, code: form.code.toUpperCase() }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Error al crear la agencia')
      return
    }
    setShowForm(false)
    setForm({ name: '', code: '', email: '', phone: '' })
    fetchAgencies()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500">{agencies.length} agencias registradas</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Nueva agencia
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-400 col-span-3">Cargando...</p>
        ) : agencies.map(a => (
          <div key={a.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 flex-shrink-0">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{a.name}</p>
                <p className="text-xs text-gray-500 font-mono">{a.code}</p>
              </div>
              <span className={`badge ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {a.active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                <span>{a._count.shipments} envíos</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{a._count.users} usuarios</span>
              </div>
            </div>
            {a.email && <p className="text-xs text-gray-400 mt-2">{a.email}</p>}
          </div>
        ))}
      </div>

      {/* Modal nueva agencia */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">Nueva Agencia</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Código (ej: MNZX) *</label>
                <input className="input uppercase" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} maxLength={10} required />
                <p className="text-xs text-gray-400 mt-1">Se usa para generar los números de guía</p>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Crear agencia'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
