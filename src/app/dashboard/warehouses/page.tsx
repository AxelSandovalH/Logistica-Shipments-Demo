'use client'
import { useEffect, useState } from 'react'
import { Warehouse, Plus, Edit2, Trash2, X, MapPin, Activity } from 'lucide-react'

const empty = { name: '', city: '', state: '', pin: '', notes: '' }

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [deleting, setDeleting] = useState<any>(null)
  const [deleting2, setDeleting2] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function fetchWarehouses() {
    setLoading(true)
    const res = await fetch('/api/warehouses')
    if (res.ok) {
      const data = await res.json()
      setWarehouses(data.warehouses)
    }
    setLoading(false)
  }

  useEffect(() => { fetchWarehouses() }, [])

  function openNew() {
    setEditing(null)
    setForm({ ...empty })
    setError('')
    setShowModal(true)
  }

  function openEdit(wh: any) {
    setEditing(wh)
    setForm({
      name:  wh.name ?? '',
      city:  wh.city ?? '',
      state: wh.state ?? '',
      pin:   wh.pin ?? '',
      notes: wh.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = editing
      ? await fetch(`/api/warehouses/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      : await fetch('/api/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Error al guardar la bodega')
      return
    }
    setShowModal(false)
    fetchWarehouses()
  }

  function openDelete(wh: any) {
    setDeleting(wh)
    setDeleteError('')
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleting2(true)
    setDeleteError('')
    const res = await fetch(`/api/warehouses/${deleting.id}`, { method: 'DELETE' })
    setDeleting2(false)
    if (!res.ok) {
      const data = await res.json()
      setDeleteError(typeof data.error === 'string' ? data.error : 'Error al eliminar')
      return
    }
    setDeleting(null)
    fetchWarehouses()
  }

  const u = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bodegas</h1>
          <p className="text-sm text-gray-500">{warehouses.length} bodegas registradas</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" />
          Nueva bodega
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-400 col-span-3">Cargando...</p>
        ) : warehouses.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin bodegas registradas</p>
            <p className="text-sm mt-1">Crea la primera bodega para habilitar el acceso de bodega.</p>
          </div>
        ) : warehouses.map(wh => (
          <div key={wh.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 flex-shrink-0">
                <Warehouse className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{wh.name}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span>{wh.city}, {wh.state}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`badge ${wh.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {wh.active ? 'Activa' : 'Inactiva'}
                </span>
                <button
                  onClick={() => openEdit(wh)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openDelete(wh)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                <span>{wh._count.events} movimientos</span>
              </div>
              {/* PIN oculto — solo se muestra un placeholder */}
              <div className="flex items-center gap-1 font-mono text-gray-300 tracking-widest text-xs">
                {'●'.repeat(wh.pin?.length ?? 4)}
              </div>
            </div>

            {wh.notes && (
              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{wh.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                {editing ? 'Editar bodega' : 'Nueva bodega'}
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
                  placeholder="Ej: Bodega LAX"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ciudad *</label>
                  <input
                    className="input"
                    value={form.city}
                    onChange={e => u('city', e.target.value)}
                    placeholder="Ej: Los Ángeles"
                    required
                  />
                </div>
                <div>
                  <label className="label">Estado *</label>
                  <input
                    className="input"
                    value={form.state}
                    onChange={e => u('state', e.target.value)}
                    placeholder="Ej: California"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">PIN de acceso *</label>
                <input
                  className="input font-mono tracking-widest"
                  placeholder="Mín. 4 dígitos numéricos"
                  maxLength={8}
                  value={form.pin}
                  onChange={e => u('pin', e.target.value.replace(/\D/g, ''))}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  El personal lo ingresa al escanear cualquier QR de bodega. Debe ser único entre todas las bodegas.
                </p>
              </div>
              <div>
                <label className="label">Notas internas</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="Dirección exacta, contacto, instrucciones... (solo visible para admins)"
                  value={form.notes}
                  onChange={e => u('notes', e.target.value)}
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
                  <label htmlFor="active" className="text-sm text-gray-700">Bodega activa</label>
                </div>
              )}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear bodega'}
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
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">¿Eliminar bodega?</h2>
            <p className="text-sm text-gray-500 text-center mb-3">
              <span className="font-semibold text-gray-700">{deleting.name}</span>
              <span className="block text-xs text-gray-400">{deleting.city}, {deleting.state}</span>
            </p>
            {deleting._count?.events > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-700">
                  ⚠️ Esta bodega tiene <span className="font-semibold">{deleting._count.events} movimiento(s)</span> registrados.
                  Se eliminarán las referencias pero los eventos de tracking se conservan.
                </p>
              </div>
            )}
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
