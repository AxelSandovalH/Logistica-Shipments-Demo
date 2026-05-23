import Image from 'next/image'
import Link from 'next/link'

export default function RegisterSuccessPage() {
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
          <h1 className="text-white text-2xl font-bold">¡Solicitud enviada!</h1>
          <p className="text-emerald-100 text-sm mt-2">Te avisaremos cuando sea aprobada</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-700 font-bold text-xs">1</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Revisamos tu solicitud</p>
              <p className="text-gray-500 text-xs mt-0.5">Nuestro equipo la revisa en las próximas 24 horas hábiles.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-700 font-bold text-xs">2</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Recibes un correo de bienvenida</p>
              <p className="text-gray-500 text-xs mt-0.5">Con el link para crear tu contraseña y acceder al sistema.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-700 font-bold text-xs">3</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Empiezas a operar</p>
              <p className="text-gray-500 text-xs mt-0.5">Creas guías, asignas choferes y rastreo en tiempo real.</p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="block w-full text-center py-3.5 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        </div>
      </div>

      <p className="text-blue-300/60 text-xs mt-6 text-center">
        ¿Preguntas? Escríbenos a{' '}
        <a href="mailto:hola@hurryops.app" className="text-blue-300 hover:text-white transition-colors">
          hola@hurryops.app
        </a>
      </p>
    </div>
  )
}
