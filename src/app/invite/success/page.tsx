import Image from 'next/image'
import Link from 'next/link'

export default function InviteSuccessPage() {
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
        <div className="bg-emerald-500 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold">¡Cuenta activada!</h1>
          <p className="text-emerald-100 text-sm mt-2">Ya puedes iniciar sesión</p>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-500 text-sm mb-6">
            Tu cuenta está lista. Entra con tu correo y la contraseña que acabas de crear.
          </p>
          <Link
            href="/login"
            className="block w-full py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors text-center"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
