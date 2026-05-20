'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Warehouse, ArrowRight, QrCode } from 'lucide-react'

export default function BodegaIndexPage() {
  const router = useRouter()
  const [guide, setGuide] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = guide.trim().toUpperCase()
    if (!clean) { setError('Ingresa el número de guía'); return }
    router.push(`/bodega/${clean}`)
  }

  return (
    <div className="min-h-screen bg-[#1e3a5f] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
        {/* Logo / Header */}
        <div className="text-center mb-7">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 mx-auto mb-3">
            <Warehouse className="w-7 h-7 text-[#1e3a5f]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">HurryOps · Bodega</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresa el número de guía para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-center font-mono text-lg font-bold tracking-widest uppercase focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-base"
              placeholder="MNZX-20260520-XXXXX"
              value={guide}
              onChange={e => { setGuide(e.target.value); setError('') }}
              autoComplete="off"
              spellCheck={false}
            />
            {error && <p className="text-xs text-red-500 mt-1.5 text-center">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1e3a5f] hover:bg-[#16304f] text-white font-semibold text-base transition-colors"
          >
            Continuar <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-5 flex items-center gap-2 text-xs text-gray-400 justify-center">
          <QrCode className="w-4 h-4" />
          Puedes escanear el QR de la guía directamente con la cámara
        </div>
      </div>
    </div>
  )
}
