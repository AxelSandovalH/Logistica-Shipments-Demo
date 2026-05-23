'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const MEXICAN_STATES = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Guanajuato',
  'Guerrero','Hidalgo','Jalisco','México','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    agencyName:  '',
    agencyCode:  '',
    contactName: '',
    email:       '',
    phone:       '',
    city:        '',
    state:       '',
    website:     '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setError('')
  }

  // Auto-generar código a partir del nombre
  function handleNameBlur() {
    if (!form.agencyCode && form.agencyName) {
      const code = form.agencyName
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      set('agencyCode', code)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar la solicitud'); setSaving(false); return }
      router.push('/register/success')
    } catch {
      setError('Error de conexión, intenta de nuevo')
      setSaving(false)
    }
  }

  const step1Valid = form.agencyName && form.agencyCode && /^[A-Z0-9]{2,8}$/.test(form.agencyCode)
  const step2Valid = form.contactName && form.email && form.email.includes('@')

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1e3a5f] flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <Image src="/logo.png" alt="HurryOps" width={28} height={28} className="rounded-lg" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-tight">HurryOps</p>
          <p className="text-blue-300 text-xs">Logística EE.UU. — México</p>
        </div>
      </div>

      <div className="w-full max-w-lg">

        {/* Pasos */}
        <div className="flex items-center gap-3 mb-6 px-1">
          {[1, 2].map(n => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                step >= n ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/40'
              }`}>{n}</div>
              <div className={`text-xs font-medium transition-colors ${step >= n ? 'text-white' : 'text-white/40'}`}>
                {n === 1 ? 'Tu agencia' : 'Tu cuenta'}
              </div>
              {n < 2 && <div className={`flex-1 h-px ${step > n ? 'bg-blue-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-[#1e3a5f] px-6 py-5">
              <p className="text-blue-200 text-xs uppercase tracking-widest mb-1">
                {step === 1 ? 'Paso 1 de 2' : 'Paso 2 de 2'}
              </p>
              <h1 className="text-white text-xl font-bold">
                {step === 1 ? 'Datos de tu agencia' : 'Datos de acceso'}
              </h1>
            </div>

            <div className="p-6 space-y-4">

              {step === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Nombre de la agencia <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="Ej: Manzanillo Express"
                      value={form.agencyName}
                      onChange={e => set('agencyName', e.target.value)}
                      onBlur={handleNameBlur}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Código de agencia <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      placeholder="Ej: MNZX (2-8 caracteres)"
                      value={form.agencyCode}
                      maxLength={8}
                      onChange={e => set('agencyCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">Se usará como prefijo en tus números de guía. Solo letras y números.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ciudad</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Manzanillo"
                        value={form.city}
                        onChange={e => set('city', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Estado</label>
                      <select
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        value={form.state}
                        onChange={e => set('state', e.target.value)}
                      >
                        <option value="">Seleccionar</option>
                        {MEXICAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sitio web</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="https://tuagencia.com (opcional)"
                      value={form.website}
                      onChange={e => set('website', e.target.value)}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Nombre del responsable <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Tu nombre completo"
                      value={form.contactName}
                      onChange={e => set('contactName', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Correo electrónico <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="tu@agencia.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">Con este correo accederás al sistema.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Teléfono</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Ej: 314 123 4567"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                    />
                  </div>

                  {/* Resumen */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">Resumen de tu solicitud</p>
                    <p className="text-sm text-blue-900 font-semibold">{form.agencyName}</p>
                    <p className="text-xs text-blue-600 font-mono">{form.agencyCode}</p>
                    {form.city && <p className="text-xs text-blue-600 mt-0.5">{form.city}{form.state ? `, ${form.state}` : ''}</p>}
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 pb-6 flex gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Atrás
                </button>
              )}
              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => step1Valid && setStep(2)}
                  disabled={!step1Valid}
                  className="flex-1 py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!step2Valid || saving}
                  className="flex-1 py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : 'Enviar solicitud'}
                </button>
              )}
            </div>
          </div>
        </form>

        <p className="text-center text-xs text-blue-300/60 mt-6">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" className="text-blue-300 hover:text-white transition-colors underline underline-offset-2">
            Iniciar sesión
          </a>
        </p>

      </div>
    </div>
  )
}
