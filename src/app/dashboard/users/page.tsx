'use client'
import { useEffect, useState } from 'react'
import { Plus, Edit2, X, ShieldCheck, Building2, Truck, Clock, CheckCircle, XCircle, Trash2, Loader2 } from 'lucide-react'

const ROLES = { ADMIN: 'Administrador', AGENCY: 'Agencia', DRIVER: 'Chofer' }
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  AGENCY: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-green-100 text-green-700',
}
const ROLE_ICONS: Record<string, any> = {
  ADMIN: ShieldCheck, AGENCY: Building2, DRIVER: Truck,
}

const emptyCreate = { name: '', email: '', password: '', role: 'AGENCY', agencyId: '' }

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [agencies, setAgencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal crear
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ ...emptyCreate })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Modal editar
  const [editing, setEditing] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', role: 'AGENCY', agencyId: '', whatsappPhone: '' })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Modal aprobar
  const [approving, setApproving] = useState<any>(null)
  const [approveForm, setApproveForm] = useState({ role: 'AGENCY', agencyId: '' })
  const [approveSaving, setApproveSaving] = useState(false)

  // Modal rechazar
  const [rejecting, setRejecting] = useState<any>(null)
  const [rejectSaving, setRejectSaving] = useState(false)

  // Toggle activo/inactivo
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function fetchData() {
    const [uRes, aRes] = await Promise.all([fetch('/api/users'), fetch('/api/agencies')])
    if (uRes.ok) setUsers((await uRes.json()).users)
    if (aRes.ok) setAgencies((await aRes.json()).agencies)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const pending = users.filter(u => u.status === 'PENDING')
  const active  = users.filter(u => u.status !== 'PENDING')

  // ── Crear ───────────────────────────────────────────────────
  function openCreate() {
    setCreateForm({ ...emptyCreate })
    setCreateError('')
    setShowCreate(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateError('')
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(typeof data.error === 'string' ? data.error : 'Error al crear usuario'); return }
    setShowCreate(false)
    fetchData()
  }

  // ── Editar ──────────────────────────────────────────────────
  function openEdit(u: any) {
    setEditing(u)
    setEditForm({ name: u.name, role: u.role, agencyId: u.agencyId ?? '', whatsappPhone: u.whatsappPhone ?? '' })
    setEditError('')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setEditError('')
    const res = await fetch(`/api/users/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, agencyId: editForm.agencyId || null, whatsappPhone: editForm.whatsappPhone || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setEditError(typeof data.error === 'string' ? data.error : 'Error al guardar'); return }
    setEditing(null); fetchData()
  }

  // ── Activar / Desactivar ────────────────────────────────────
  async function toggleActive(u: any) {
    if (togglingId) return
    setTogglingId(u.id)
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !u.active }),
    })
    await fetchData()
    setTogglingId(null)
  }

  // ── Aprobar ─────────────────────────────────────────────────
  function openApprove(u: any) {
    setApproving(u)
    setApproveForm({ role: 'AGENCY', agencyId: '' })
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault()
    setApproveSaving(true)
    await fetch(`/api/users/${approving.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ACTIVE',
        role: approveForm.role,
        agencyId: approveForm.agencyId || null,
      }),
    })
    setApproveSaving(false); setApproving(null); fetchData()
  }

  // ── Rechazar ────────────────────────────────────────────────
  async function handleReject() {
    setRejectSaving(true)
    await fetch(`/api/users/${rejecting.id}`, { method: 'DELETE' })
    setRejectSaving(false); setRejecting(null); fetchData()
  }

  const uc = (f: string, v: string) => setCreateForm(p => ({ ...p, [f]: v }))
  const ue = (f: string, v: string) => setEditForm(p => ({ ...p, [f]: v }))
  const ua = (f: string, v: string) => setApproveForm(p => ({ ...p, [f]: v }))

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500">{active.length} activos{pending.length > 0 ? ` · ${pending.length} pendientes` : ''}</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {/* ── Solicitudes pendientes ── */}
      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">Solicitudes pendientes</h2>
            <span className="badge bg-amber-100 text-amber-700">{pending.length}</span>
          </div>
          <div className="card overflow-hidden p-0 border-amber-200">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 border-b border-amber-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha solicitud</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {pending.map(u => (
                  <tr key={u.id} className="hover:bg-amber-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openApprove(u)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                        </button>
                        <button
                          onClick={() => setRejecting(u)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabla de usuarios activos ── */}
      <div>
        {pending.length > 0 && (
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Usuarios activos</h2>
        )}
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Rol</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Agencia</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Cargando...</td></tr>
              ) : active.map(u => {
                const RoleIcon = ROLE_ICONS[u.role]
                return (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge inline-flex items-center gap-1 ${ROLE_COLORS[u.role]}`}>
                        <RoleIcon className="w-3 h-3" />
                        {ROLES[u.role as keyof typeof ROLES]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.agency?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={togglingId === u.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${u.active ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}
                        >
                          {togglingId === u.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : u.active ? 'Desactivar' : 'Activar'
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal crear usuario ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Nuevo usuario</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div><label className="label">Nombre *</label><input className="input" value={createForm.name} onChange={e => uc('name', e.target.value)} required /></div>
              <div><label className="label">Email *</label><input type="email" className="input" value={createForm.email} onChange={e => uc('email', e.target.value)} required /></div>
              <div>
                <label className="label">Contraseña *</label>
                <input type="password" className="input" value={createForm.password} onChange={e => uc('password', e.target.value)} required minLength={6} />
                <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={createForm.role} onChange={e => uc('role', e.target.value)}>
                  <option value="ADMIN">Administrador</option>
                  <option value="AGENCY">Agencia</option>
                  <option value="DRIVER">Chofer</option>
                </select>
              </div>
              {(createForm.role === 'AGENCY' || createForm.role === 'DRIVER') && (
                <div>
                  <label className="label">Agencia</label>
                  <select className="input" value={createForm.agencyId} onChange={e => uc('agencyId', e.target.value)}>
                    <option value="">Sin agencia</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {createError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{createError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>{creating ? 'Creando...' : 'Crear usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal editar usuario ── */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Editar usuario</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div><label className="label">Nombre *</label><input className="input" value={editForm.name} onChange={e => ue('name', e.target.value)} required /></div>
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={editForm.role} onChange={e => ue('role', e.target.value)}>
                  <option value="ADMIN">Administrador</option>
                  <option value="AGENCY">Agencia</option>
                  <option value="DRIVER">Chofer</option>
                </select>
              </div>
              {(editForm.role === 'AGENCY' || editForm.role === 'DRIVER') && (
                <div>
                  <label className="label">Agencia</label>
                  <select className="input" value={editForm.agencyId} onChange={e => ue('agencyId', e.target.value)}>
                    <option value="">Sin agencia</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">WhatsApp</label>
                <input
                  className="input"
                  placeholder="Ej: 526671234567 (con código de país, sin +)"
                  value={editForm.whatsappPhone}
                  onChange={e => ue('whatsappPhone', e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-gray-400 mt-1">Vincular permite usar el agente de WhatsApp con esta cuenta.</p>
              </div>
              {editError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{editError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(null)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal aprobar ── */}
      {approving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Aprobar solicitud</h2>
              <button onClick={() => setApproving(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleApprove} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Configura el acceso de <span className="font-semibold text-gray-800">{approving.name}</span> antes de aprobar.</p>
              <div>
                <label className="label">Rol *</label>
                <select className="input" value={approveForm.role} onChange={e => ua('role', e.target.value)}>
                  <option value="ADMIN">Administrador</option>
                  <option value="AGENCY">Agencia</option>
                  <option value="DRIVER">Chofer</option>
                </select>
              </div>
              {(approveForm.role === 'AGENCY' || approveForm.role === 'DRIVER') && (
                <div>
                  <label className="label">Agencia</label>
                  <select className="input" value={approveForm.agencyId} onChange={e => ua('agencyId', e.target.value)}>
                    <option value="">Sin agencia</option>
                    {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setApproving(null)}>Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50" disabled={approveSaving}>
                  {approveSaving ? 'Aprobando...' : 'Aprobar acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal rechazar ── */}
      {rejecting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">¿Rechazar solicitud?</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              La cuenta de <span className="font-semibold text-gray-700">{rejecting.name}</span> será eliminada permanentemente.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setRejecting(null)}>Cancelar</button>
              <button
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                onClick={handleReject} disabled={rejectSaving}
              >
                {rejectSaving ? 'Rechazando...' : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
