'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

export default function InvitePage() {
  const { token } = useParams()
  const router    = useRouter()

  const [info, setInfo]         = useState<any>(null)
  const [loadError, setLoadError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLoadError(d.error)
        else setInfo(d.user)
      })
      .catch(() => setLoadError('Error de conexión'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }

    setSaving(true); setError('')
    const res = await fetch(`/api/invite/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error al crear la cuenta'); return }
    router.push('/invite/success')
  }

  const roleLabel = info?.role === 'DRIVER' ? 'Chofer' : 'Operador'

  // ── Error de carga ───────────────────────────────────
  if (loadError) return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-bold text-gray-900 text-lg mb-2">Link no válido</p>
        <p className="text-gray-500 text-sm">{loadError}</p>
      </div>
    </div>
  )

  // ── Cargando ─────────────────────────────────────────
  if (!info) return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] flex items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  // ── Formulario ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] flex flex-col items-center justify-center px-4 py-12">

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <Image src="/logo.png" alt="HurryOps" width={28} height={28} className="rounded-lg" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">HurryOps</p>
          <p className="text-blue-300 text-xs">Logística EE.UU. — México</p>
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1e3a5f] px-6 py-6">
          <p className="text-blue-300 text-xs uppercase tracking-widest mb-1">Invitación de equipo</p>
          <h1 className="text-white text-xl font-bold">Crea tu contraseña</h1>
        </div>

        <div className="p-6">
          {/* Info del usuario */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">{info.agency?.name}</p>
            <p className="font-bold text-gray-900">{info.name}</p>
            <p className="text-sm text-gray-500">{info.email}</p>
            <span className="inline-block mt-2 text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
              {roleLabel}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Confirmar contraseña <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving || !password || !confirm}
              className="w-full py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando cuenta...</>
              ) : 'Activar mi cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
