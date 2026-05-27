'use client'
import { useEffect, useState } from 'react'
import { Users, UserPlus, Truck, Shield, Clock, CheckCircle, XCircle, Trash2, ToggleLeft, ToggleRight, X, Send } from 'lucide-react'

const ROLE_LABEL: Record<string, string> = { AGENCY: 'Operador', DRIVER: 'Chofer' }
const ROLE_COLOR: Record<string, string> = {
  AGENCY: 'bg-blue-100 text-blue-700',
  DRIVER: 'bg-violet-100 text-violet-700',
}
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:   'text-emerald-600',
  PENDING:  'text-amber-500',
  INACTIVE: 'text-gray-400',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE:   'Activo',
  PENDING:  'Invitación pendiente',
  INACTIVE: 'Inactivo',
}

export default function TeamPage() {
  const [members, setMembers]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm]         = useState({ name: '', email: '', role: 'DRIVER' })
  const [saving, setSaving]     = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSent, setInviteSent]   = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [delTarget, setDelTarget] = useState<any>(null)

  async function load() {
    setLoading(true)
    const r = await fetch('/api/team')
    if (r.ok) { const d = await r.json(); setMembers(d.members) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setInviteError('')
    const r = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    setSaving(false)
    if (!r.ok) { setInviteError(d.error ?? 'Error al enviar la invitación'); return }
    setInviteSent(true)
    setForm({ name: '', email: '', role: 'DRIVER' })
    load()
    setTimeout(() => { setShowInvite(false); setInviteSent(false) }, 2000)
  }

  async function toggleActive(member: any) {
    setActionId(member.id)
    await fetch(`/api/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !member.active }),
    })
    setActionId(null)
    load()
  }

  async function handleDelete() {
    if (!delTarget) return
    setActionId(delTarget.id)
    const r = await fetch(`/api/team/${delTarget.id}`, { method: 'DELETE' })
    setActionId(null)
    if (!r.ok) { const d = await r.json(); alert(d.error); return }
    setDelTarget(null)
    load()
  }

  const drivers    = members.filter(m => m.role === 'DRIVER')
  const operators  = members.filter(m => m.role === 'AGENCY')
  const pendingCt  = members.filter(m => m.status === 'PENDING').length

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.length} miembros{pendingCt > 0 && ` · ${pendingCt} invitación${pendingCt > 1 ? 'es' : ''} pendiente${pendingCt > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => { setShowInvite(true); setInviteError(''); setInviteSent(false) }} className="btn-primary">
          <UserPlus className="w-4 h-4" /> Invitar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando...</p>
      ) : members.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin miembros de equipo</p>
          <p className="text-sm mt-1">Invita a tu primer chofer u operador</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Choferes */}
          {drivers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-violet-500" />
                <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Choferes</h2>
                <span className="text-xs bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full">{drivers.length}</span>
              </div>
              <div className="space-y-3">
                {drivers.map(m => <MemberRow key={m.id} member={m} onToggle={toggleActive} onDelete={setDelTarget} actionId={actionId} />)}
              </div>
            </section>
          )}

          {/* Operadores */}
          {operators.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-blue-500" />
                <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Operadores</h2>
                <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{operators.length}</span>
              </div>
              <div className="space-y-3">
                {operators.map(m => <MemberRow key={m.id} member={m} onToggle={toggleActive} onDelete={setDelTarget} actionId={actionId} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── MODAL INVITAR ───────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Invitar miembro</h2>
              <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteSent ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="font-bold text-gray-900">¡Invitación enviada!</p>
                <p className="text-sm text-gray-500 mt-1">Le llegará un correo con instrucciones.</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nombre *</label>
                  <input
                    className="input"
                    placeholder="Nombre completo"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Correo electrónico *</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rol *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ value: 'DRIVER', label: 'Chofer', icon: Truck }, { value: 'AGENCY', label: 'Operador', icon: Shield }].map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, role: r.value }))}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          form.role === r.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <r.icon className="w-4 h-4" />
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                {inviteError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{inviteError}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-secondary flex-1" onClick={() => setShowInvite(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary flex-1" disabled={saving}>
                    {saving ? 'Enviando...' : <><Send className="w-4 h-4" /> Enviar invitación</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR ──────────────────────────────────── */}
      {delTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <p className="font-bold text-gray-900 mb-1">¿Eliminar usuario?</p>
            <p className="text-sm text-gray-500 mb-5">{delTarget.name}</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDelTarget(null)}>Cancelar</button>
              <button
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                onClick={handleDelete}
                disabled={actionId === delTarget.id}
              >
                {actionId === delTarget.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MemberRow({ member, onToggle, onDelete, actionId }: {
  member: any
  onToggle: (m: any) => void
  onDelete: (m: any) => void
  actionId: string | null
}) {
  const isLoading = actionId === member.id
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 transition-opacity ${!member.active ? 'opacity-60' : ''}`}>
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 font-bold text-gray-500 text-sm">
        {member.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-900 text-sm">{member.name}</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLOR[member.role]}`}>
            {ROLE_LABEL[member.role]}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{member.email}</p>
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${STATUS_COLOR[member.status]}`}>
          {member.status === 'PENDING'  && <Clock className="w-3 h-3" />}
          {member.status === 'ACTIVE'   && <CheckCircle className="w-3 h-3" />}
          {member.status === 'INACTIVE' && <XCircle className="w-3 h-3" />}
          {STATUS_LABEL[member.status]}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {member.role === 'DRIVER' && member.status === 'ACTIVE' && (
          <a
            href={`/api/driver/manifest?driverId=${member.id}`}
            download
            className="p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            title="Descargar manifiesto de salida"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </a>
        )}
        {member.status !== 'PENDING' && (
          <button
            onClick={() => onToggle(member)}
            disabled={isLoading}
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
            title={member.active ? 'Desactivar' : 'Activar'}
          >
            {member.active
              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
              : <ToggleLeft className="w-5 h-5" />}
          </button>
        )}
        <button
          onClick={() => onDelete(member)}
          disabled={isLoading}
          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
