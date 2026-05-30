'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { Printer } from 'lucide-react'

function BatchPrintContent() {
  const searchParams = useSearchParams()
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const guides = (searchParams.get('guides') ?? '').split(',').filter(Boolean)
    if (!guides.length) { setLoading(false); return }

    Promise.all(
      guides.map(g => fetch(`/api/bodega/${g}`).then(r => r.json()).then(d => d.shipment).catch(() => null))
    ).then(results => {
      setShipments(results.filter(Boolean))
      setLoading(false)
    })
  }, [searchParams])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando guías...</div>
  )
  if (!shipments.length) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">No se encontraron guías</div>
  )

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hurryops.app'

  return (
    <div>
      {/* Botón imprimir */}
      <div className="print:hidden flex items-center justify-between p-4 bg-gray-100 border-b">
        <p className="text-sm text-gray-600 font-medium">{shipments.length} guías — {shipments[0]?.senderName}</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" />
          Imprimir todas
        </button>
      </div>

      <div className="p-6 print:p-0 space-y-6 print:space-y-0">
        {shipments.map((shipment, idx) => {
          const bodegaUrl = `${origin}/bodega/${shipment.guideNumber}`
          const trackUrl  = `${origin}/track/${shipment.guideNumber}`
          return (
            <div key={shipment.id} className={idx > 0 ? 'print:break-before-page' : ''}>
              <div className="max-w-2xl mx-auto print:max-w-full">
                <div className="border-2 border-gray-900 rounded-lg print:rounded-none overflow-hidden">

                  {/* Header */}
                  <div className="bg-gray-900 text-white px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg tracking-wide">HurryOps</p>
                      <p className="text-xs text-gray-400">Logística EE.UU. — México</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Agencia</p>
                      <p className="font-semibold text-sm">{shipment.agency?.name}</p>
                      <p className="text-xs font-mono text-gray-300">{shipment.agency?.code}</p>
                    </div>
                  </div>

                  {/* Número de guía */}
                  <div className="bg-blue-50 px-5 py-4 border-b-2 border-gray-900">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Número de Guía</p>
                    <p className="font-mono text-3xl font-black text-gray-900 tracking-wider">{shipment.guideNumber}</p>
                  </div>

                  {/* Cuerpo */}
                  <div className="grid grid-cols-2 gap-0">
                    {/* Remitente */}
                    <div className="px-5 py-4 border-r border-b border-gray-300">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Remitente (EE.UU.)</p>
                      <p className="font-semibold text-gray-900">{shipment.senderName}</p>
                      {shipment.senderPhone && <p className="text-sm text-gray-600">{shipment.senderPhone}</p>}
                      {shipment.origin && (
                        <div className="mt-1 text-sm text-gray-600">
                          <p>{shipment.origin.street}</p>
                          <p>{shipment.origin.city}, {shipment.origin.state} {shipment.origin.zip}</p>
                        </div>
                      )}
                    </div>

                    {/* QR bodega */}
                    <div className="px-5 py-4 border-b border-gray-300 flex flex-col items-center justify-center">
                      <QRCode value={bodegaUrl} size={110} />
                      <p className="text-xs text-gray-400 mt-2 text-center">Escanear en bodega</p>
                    </div>

                    {/* Destinatario */}
                    <div className="px-5 py-4 border-r border-gray-300">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Destinatario (México)</p>
                      <p className="font-bold text-gray-900 text-base">{shipment.recipientName}</p>
                      {shipment.recipientPhone && (
                        <p className="text-sm text-gray-600">
                          {shipment.recipientPhone.slice(0, -4).replace(/\d/g, '*') + shipment.recipientPhone.slice(-4)}
                        </p>
                      )}
                      {shipment.destination && (
                        <div className="mt-1 text-sm text-gray-600">
                          <p>{shipment.destination.street}{shipment.destination.colonia ? `, ${shipment.destination.colonia}` : ''}</p>
                          <p>{shipment.destination.city}, {shipment.destination.state} {shipment.destination.zip}</p>
                          {shipment.destination.references && (
                            <p className="text-xs text-gray-500 mt-0.5">Ref: {shipment.destination.references}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* QR tracking */}
                    <div className="px-5 py-4 flex flex-col items-center justify-center gap-2">
                      <QRCode value={trackUrl} size={110} />
                      <p className="text-xs text-gray-400 text-center">Seguimiento del envío</p>
                      <p className="text-[10px] text-gray-300 text-center">Detalles visibles al escanear</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="bg-gray-50 px-5 py-3 border-t border-gray-300 flex items-center justify-between text-xs text-gray-400">
                    <p>Creado: {new Date(shipment.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="font-mono">{shipment.guideNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BatchPrintPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Cargando guías...</div>}>
      <BatchPrintContent />
    </Suspense>
  )
}
