'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { Printer } from 'lucide-react'

export default function PrintGuidePage() {
  const { id } = useParams()
  const [shipment, setShipment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/shipments/${id}`)
      .then(r => r.json())
      .then(d => { setShipment(d.shipment); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando guía...</div>
  )
  if (!shipment) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Envío no encontrado</div>
  )

  const bodegaUrl = `${window.location.origin}/bodega/${shipment.guideNumber}`
  const trackUrl  = `${window.location.origin}/track/${shipment.guideNumber}`

  return (
    <div>
      {/* Botón imprimir — se oculta al imprimir */}
      <div className="print:hidden flex justify-end p-4 bg-gray-100 border-b">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" />
          Imprimir guía
        </button>
      </div>

      {/* Etiqueta imprimible */}
      <div className="max-w-2xl mx-auto p-6 print:p-0 print:max-w-full">
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

          {/* Número de guía destacado */}
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

            {/* QR de bodega */}
            <div className="px-5 py-4 border-b border-gray-300 flex flex-col items-center justify-center">
              <QRCode value={bodegaUrl} size={110} />
              <p className="text-xs text-gray-400 mt-2 text-center">Escanear en bodega</p>
            </div>

            {/* Destinatario */}
            <div className="px-5 py-4 border-r border-gray-300">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Destinatario (México)</p>
              <p className="font-bold text-gray-900 text-base">{shipment.recipientName}</p>
              {shipment.recipientPhone && <p className="text-sm text-gray-600">{shipment.recipientPhone}</p>}
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

            {/* Paquete + QR tracking */}
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Paquete</p>
                <div className="text-sm text-gray-700 space-y-0.5">
                  {shipment.weight && <p>Peso: <span className="font-medium">{shipment.weight} kg</span></p>}
                  {shipment.pieces > 1 && <p>Piezas: <span className="font-medium">{shipment.pieces}</span></p>}
                  {shipment.description && <p>Contenido: <span className="font-medium">{shipment.description}</span></p>}
                  {shipment.serviceType && (
                    <p>Servicio: <span className="font-medium">
                      {shipment.serviceType === 'EXPRESS' ? 'Express' : shipment.serviceType === 'ECONOMY' ? 'Económico' : 'Estándar'}
                    </span></p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <QRCode value={trackUrl} size={75} />
                <p className="text-xs text-gray-400 mt-1 text-center">Tracking cliente</p>
              </div>
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
}
