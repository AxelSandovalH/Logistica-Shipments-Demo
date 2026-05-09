'use client'
import { useEffect, useState } from 'react'
import { Building2, Plus, Package, Users, Edit2, Trash2, X } from 'lucide-react'

const empty = { name: '', code: '', email: '', phone: '' }

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal crear / editar
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal confirmar eliminar
  const [deleting, setDeleting] = useState<any>(null)
  const [deleting2, setDeleting2] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function fetchAgencies() {
    setLoading(true)
    const res = await fetch('/api/agencies')
    if (res.ok) {
      const data = await res.json()
      setAgencies(data.agencies)
    }
    setLoading(false)
  }

  useEffect(() => { fetchAgencies() }, [])

  function openNew() {
    setEditing(null)
    setForm({ ...empty })
    setError('')
    setShowModal(true)
  }

  function openEdit(agency: any) {
    setEditing(agency)
    setForm({
      name: agency.name ?? '',
      code: agency.code ?? '',
      email: agency.email ?? '',
      phone: agency.phone ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = { ...form, code: form.code.toUpperCase() }
    const res = editing
      ? await fetch(`/api/agencies/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/agencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Error al guardar la agencia')
      return
    }
    setShowModal(false)
    fetchAgencies()
  }

  function openDelete(agency: any) {
    setDeleting(agency)
    setDeleteError('')
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleting2(true)
    setDeleteError('')
    const res = await fetch(`/api/agencies/${deleting.id}`, { method: 'DELETE' })
    setDeleting2(false)
    if (!res.ok) {
      const data = await res.json()
      setDeleteError(typeof data.error === 'string' ? data.error : 'Error al eliminar')
      return
    }
    setDeleting(null)
    fetchAgencies()
  }

  const u = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500">{agencies.length} agencias registradas</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Nueva agencia
        </button>
      </div>

      {/* Grid de agencias */}
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
              <div className="flex items-center gap-1">
                <span className={`badge ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {a.active ? 'Activa' : 'Inactiva'}
                </span>
                <button
                  onClick={() => openEdit(a)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openDelete(a)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editing ? 'Editar agencia' : 'Nueva agencia'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => u('name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Código (ej: MNZX) *</label>
                <input
                  className="input uppercase"
                  value={form.code}
                  onChange={e => u('code', e.target.value.toUpperCase())}
                  maxLength={10}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Se usa para generar los números de guía</p>
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={e => u('email', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={e => u('phone', e.target.value)}
                />
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={(form as any).active ?? true}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked } as any))}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <label htmlFor="active" className="text-sm text-gray-700">Agencia activa</label>
                </div>
              )}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear agencia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">¿Eliminar agencia?</h2>
            <p className="text-sm text-gray-500 text-center mb-3">
              <span className="font-semibold text-gray-700">{deleting.name}</span>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 space-y-1">
              {deleting._count?.users > 0 && (
                <p className="text-xs text-amber-700">
                  ⚠️ <span className="font-semibold">{deleting._count.users} usuario(s)</span> serán desactivados y desvinculados.
                </p>
              )}
              {deleting._count?.shipments > 0 && (
                <p className="text-xs text-red-600">
                  🚫 Tiene <span className="font-semibold">{deleting._count.shipments} envío(s)</span> — no se puede eliminar.
                </p>
              )}
              {deleting._count?.users === 0 && deleting._count?.shipments === 0 && (
                <p className="text-xs text-gray-500">Sin datos asociados. La eliminación es segura.</p>
              )}
            </div>
            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3 text-center">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting2}
              >
                {deleting2 ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
