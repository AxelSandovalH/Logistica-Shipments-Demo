'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

/**
 * Drop this into any Server Component page to get a "Hay actualizaciones"
 * banner whenever the Shipment table changes.
 */
export function RealtimeBanner() {
  const router       = useRouter()
  const [show, setShow] = useState(false)

  useRealtimeRefresh('Shipment', () => setShow(true))

  if (!show) return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 text-xs text-gray-400">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      En vivo
    </div>
  )

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#1e3a5f] text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-xl animate-bounce-once">
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
      Hay actualizaciones
      <button
        onClick={() => { router.refresh(); setShow(false) }}
        className="bg-white text-[#1e3a5f] text-xs font-bold px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors ml-1"
      >
        Actualizar
      </button>
    </div>
  )
}
