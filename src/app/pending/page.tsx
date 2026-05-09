'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Clock, LogOut, Mail } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        {/* Ícono */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto mb-5">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>

        {/* Título */}
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Solicitud en revisión
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Tu cuenta fue creada exitosamente. Un administrador de{' '}
          <span className="font-semibold text-blue-700">HurryOps</span> revisará
          tu solicitud y te habilitará el acceso en breve.
        </p>

        {/* Info */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left space-y-2">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">¿Qué sigue?</p>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>Recibirás un correo cuando tu cuenta sea aprobada y lista para usar.</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>El tiempo de revisión es normalmente de menos de 24 horas.</span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
