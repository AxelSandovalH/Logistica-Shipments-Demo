import { Package } from 'lucide-react'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mx-auto mb-4">
          <Package className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Guía no encontrada</h1>
        <p className="text-blue-200 mb-6">
          El número de guía que ingresaste no existe o aún no ha sido registrado en el sistema.
        </p>
        <p className="text-blue-300 text-sm">HurryOps</p>
      </div>
    </div>
  )
}
