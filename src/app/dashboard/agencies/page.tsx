'use client'
import { useEffect, useState } from 'react'
import { Building2, Plus, Package, Users, Edit2, Trash2, X, Clock, CheckCircle, XCircle, Phone, Mail, MapPin } from 'lucide-react'

const empty = { name: '', code: '', email: '', phone: '' }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  PENDING:   'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Activa',
  PENDING:   'Pendiente',
  SUSPENDED: 'Suspendida',
}

export default function AgenciesPage() {
  const [agencies, setAgencies]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<any>(null)
  const [form, setForm]             = useState({ ...empty })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [deleting, setDeleting]     = useState<any>(null)
  const [deleting2, setDeleting2]   = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function fetchAgencies() {
    setLoading(true)
    const res = await fetch('/api/agencies')
    if (res.ok) { const d = await res.json(); setAgencies(d.agencies) }
    setLoading(false)
  }

  useEffect(() => { fetchAgencies() }, [])

  async function approve(id: string) {
    setActionLoading(id)
    await fetch(`/api/agencies/${id}/approve`, { method: 'POST' })
    setActionLoading(null)
    fetchAgencies()
  }

  async function reject(id: string) {
    setActionLoading(id)
    await fetch(`/api/agencies/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason || undefined }),
    })
    setActionLoading(null)
    setRejectTarget(null)
    setRejectReason('')
    fetchAgencies()
  }

  function openNew() {
    setEditing(null); setForm({ ...empty }); setError(''); setShowModal(true)
  }
  function openEdit(a: any) {
    setEditing(a)
    setForm({ name: a.name ?? '', code: a.code ?? '', email: a.email ?? '', phone: a.phone ?? '' })
    setError(''); setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, code: form.code.toUpperCase() }
    const res = editing
      ? await fetch(`/api/agencies/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/agencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(typeof data.error === 'string' ? data.error : 'Error al guardar'); return }
    setShowModal(false); fetchAgencies()
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleting2(true); setDeleteError('')
    const res = await fetch(`/api/agencies/${deleting.id}`, { method: 'DELETE' })
    setDeleting2(false)
    if (!res.ok) { const d = await res.json(); setDeleteError(typeof d.error === 'string' ? d.error : 'Error al eliminar'); return }
    setDeleting(null); fetchAgencies()
  }

  const u = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }))

  const pending = agencies.filter(a => a.status === 'PENDING')
  const active  = agencies.filter(a => a.status !== 'PENDING')

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agencias</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} activas{pending.length > 0 && ` · ${pending.length} pendiente${pending.length > 1 ? 's' : ''} de aprobación`}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus className="w-4 h-4" /> Nueva agencia
        </button>
      </div>

      {/* ── PENDIENTES ──────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Solicitudes pendientes</h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          </div>
          <div className="space-y-4">
            {pending.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
                <div className="bg-amber-50 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Pendiente de aprobación</span>
                  </div>
                  <span className="text-xs text-amber-600">
                    {new Date(a.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-gray-900 text-lg">{a.name}</p>
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{a.code}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        {a.contactName && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{a.contactName}</span>}
                        {a.email       && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{a.email}</span>}
                        {a.phone       && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{a.phone}</span>}
                        {a.city        && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{a.city}{a.state ? `, ${a.state}` : ''}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setRejectTarget(a)}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Rechazar
                      </button>
                      <button
                        onClick={() => approve(a.id)}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === a.id
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <CheckCircle className="w-4 h-4" />}
                        Aprobar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AGENCIAS ACTIVAS / SUSPENDIDAS ──────────────────── */}
      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : active.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin agencias registradas</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-4">Agencias</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {active.map(a => (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{a.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{a.code}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`badge ${STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setDeleting(a); setDeleteError('') }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{a._count?.shipments ?? 0} envíos</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{a._count?.users ?? 0} usuarios</span>
                  </div>
                  {a.contactName && <p className="text-xs text-gray-400 mt-2 truncate">{a.contactName}</p>}
                  {a.email       && <p className="text-xs text-gray-400 truncate">{a.email}</p>}
                  {a.city        && <p className="text-xs text-gray-400">{a.city}{a.state ? `, ${a.state}` : ''}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── MODAL RECHAZAR ─────────────────────────────────── */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">Rechazar solicitud</h2>
            <p className="text-sm text-gray-500 text-center mb-4">{rejectTarget.name}</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
              rows={3}
              placeholder="Motivo del rechazo (opcional, se enviará al solicitante)"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => { setRejectTarget(null); setRejectReason('') }}>Cancelar</button>
              <button
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                onClick={() => reject(rejectTarget.id)}
                disabled={actionLoading === rejectTarget.id}
              >
                {actionLoading === rejectTarget.id ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CREAR / EDITAR ────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editing ? 'Editar agencia' : 'Nueva agencia'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => u('name', e.target.value)} required /></div>
              <div>
                <label className="label">Código (ej: MNZX) *</label>
                <input className="input uppercase" value={form.code} onChange={e => u('code', e.target.value.toUpperCase())} maxLength={10} required />
                <p className="text-xs text-gray-400 mt-1">Se usa para generar los números de guía</p>
              </div>
              <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => u('email', e.target.value)} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e => u('phone', e.target.value)} /></div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active" checked={(form as any).active ?? true} onChange={e => setForm(f => ({ ...f, active: e.target.checked } as any))} className="rounded border-gray-300 text-blue-600" />
                  <label htmlFor="active" className="text-sm text-gray-700">Agencia activa</label>
                </div>
              )}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear agencia'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR ──────────────────────────────────── */}
      {deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center mb-1">¿Eliminar agencia?</h2>
            <p className="text-sm text-gray-500 text-center mb-3"><span className="font-semibold text-gray-700">{deleting.name}</span></p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 space-y-1">
              {deleting._count?.users > 0 && <p className="text-xs text-amber-700">⚠️ <span className="font-semibold">{deleting._count.users} usuario(s)</span> serán desvinculados.</p>}
              {deleting._count?.shipments > 0 && <p className="text-xs text-red-600">🚫 Tiene <span className="font-semibold">{deleting._count.shipments} envío(s)</span> — no se puede eliminar.</p>}
              {!deleting._count?.users && !deleting._count?.shipments && <p className="text-xs text-gray-500">Sin datos asociados. La eliminación es segura.</p>}
            </div>
            {deleteError && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mb-3 text-center">{deleteError}</p>}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleting(null)}>Cancelar</button>
              <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50" onClick={handleDelete} disabled={deleting2}>
                {deleting2 ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
