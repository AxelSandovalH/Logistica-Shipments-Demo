'use client'
import { useEffect, useState } from 'react'
import { Users, Plus, UserCheck } from 'lucide-react'

const ROLES = { ADMIN: 'Administrador', AGENCY: 'Agencia', DRIVER: 'Chofer' }
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  AGENCY: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-green-100 text-green-700',
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'AGENCY', agencyId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchData() {
    const [uRes, aRes] = await Promise.all([fetch('/api/users'), fetch('/api/agencies')])
    if (uRes.ok) setUsers((await uRes.json()).users)
    if (aRes.ok) setAgencies((await aRes.json()).agencies)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Error al crear usuario')
      return
    }
    setShowForm(false)
    setForm({ name: '', email: '', password: '', role: 'AGENCY', agencyId: '' })
    fetchData()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">{users.length} usuarios registrados</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Rol</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Agencia</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${ROLE_COLORS[u.role]}`}>{ROLES[u.role as keyof typeof ROLES]}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.agency?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">Nuevo Usuario</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Contraseña *</label>
                <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="ADMIN">Administrador</option>
                  <option value="AGENCY">Agencia</option>
                  <option value="DRIVER">Chofer</option>
                </select>
              </div>
              {(form.role === 'AGENCY' || form.role === 'DRIVER') && (
                <div>
                  <label className="label">Agencia</label>
                  <select className="input" value={form.agencyId} onChange={e => setForm(f => ({ ...f, agencyId: e.target.value }))}>
                    <option value="">Sin agencia</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
