'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function PortalPage() {
  const router = useRouter()
  const [step, setStep]       = useState<'email' | 'otp'>('email')
  const [email, setEmail]     = useState('')
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const r = await fetch('/api/portal/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error ?? 'Error al enviar el código'); return }
    setStep('otp')
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const r = await fetch('/api/portal/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { setError(d.error ?? 'Código incorrecto'); return }
    router.push('/portal/home')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] flex flex-col items-center justify-center px-4 py-12">

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <Image src="/logo.png" alt="HurryOps" width={28} height={28} className="rounded-lg" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">HurryOps</p>
          <p className="text-blue-300 text-xs">Portal del cliente</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1e3a5f] px-6 py-6 text-center">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-bold">Mis envíos</h1>
          <p className="text-blue-300 text-sm mt-1">
            {step === 'email' ? 'Ingresa tu correo para continuar' : `Código enviado a ${email}`}
          </p>
        </div>

        <div className="p-6">
          {step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Usa el correo con el que recibiste tus guías.
                </p>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
                  : 'Enviar código'}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full border border-gray-200 rounded-xl px-4 py-4 text-3xl font-bold text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                  placeholder="––––––"
                  value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1.5 text-center">Válido por 15 minutos</p>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verificando...</>
                  : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Usar otro correo
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="text-blue-300/50 text-xs mt-6">
        ¿Quieres rastrear una guía sin login?{' '}
        <a href="/track" className="text-blue-300 hover:text-white transition-colors underline underline-offset-2">
          Rastreo público
        </a>
      </p>
    </div>
  )
}
