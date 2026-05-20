import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Package, MapPin, CheckCircle, TruckIcon, AlertCircle, RotateCcw, Clock, Navigation } from 'lucide-react'
import Image from 'next/image'
import { STATUS_LABELS } from '@/lib/utils'

const STATUS_ICONS: Record<string, React.ElementType> = {
  RECEIVED: Package,
  IN_TRANSIT: TruckIcon,
  OUT_FOR_DELIVERY: MapPin,
  DELIVERED: CheckCircle,
  FAILED: AlertCircle,
  RETURNED: RotateCcw,
}

const STATUS_BG: Record<string, string> = {
  RECEIVED: 'bg-blue-500',
  IN_TRANSIT: 'bg-yellow-500',
  OUT_FOR_DELIVERY: 'bg-orange-500',
  DELIVERED: 'bg-green-500',
  FAILED: 'bg-red-500',
  RETURNED: 'bg-gray-500',
}

const PROGRESS: Record<string, number> = {
  RECEIVED: 20,
  IN_TRANSIT: 50,
  OUT_FOR_DELIVERY: 80,
  DELIVERED: 100,
  FAILED: 0,
  RETURNED: 0,
}

export default async function TrackingPage({ params }: { params: { guide: string } }) {
  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: params.guide },
    include: {
      agency: true,
      destination: true,
      events: { orderBy: { createdAt: 'asc' } },
      assignedDriver: { select: { id: true, name: true } },
    },
  })

  if (!shipment) notFound()

  const Icon = STATUS_ICONS[shipment.status] ?? Package
  const progress = PROGRESS[shipment.status] ?? 0

  // Verificar si el chofer tiene GPS activo
  let driverLocation: { lat: number; lng: number } | null = null
  if (shipment.status === 'OUT_FOR_DELIVERY' && shipment.assignedDriverId) {
    const loc = await prisma.driverLocation.findUnique({
      where: { driverId: shipment.assignedDriverId },
      select: { lat: true, lng: true, active: true, updatedAt: true },
    })
    const stale = loc ? (Date.now() - new Date(loc.updatedAt).getTime()) > 5 * 60 * 1000 : true
    if (loc && loc.active && !stale) driverLocation = { lat: loc.lat, lng: loc.lng }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700">
      {/* Header */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt="HurryOps" width={40} height={40} className="rounded-xl flex-shrink-0" />
          <div>
            <p className="font-bold text-white">HurryOps</p>
            <p className="text-xs text-blue-200">Seguimiento de envío</p>
          </div>
        </div>

        {/* Banner GPS activo */}
        {driverLocation && (
          <div className="bg-green-400 text-green-900 rounded-2xl px-5 py-3 mb-4 flex items-center gap-3 shadow">
            <Navigation className="w-5 h-5 animate-pulse shrink-0" />
            <div>
              <p className="font-bold text-sm">Tu chofer está en camino</p>
              <a
                href={`https://maps.google.com/?q=${driverLocation.lat},${driverLocation.lng}`}
                target="_blank"
                className="text-xs underline"
              >
                Ver ubicación aproximada →
              </a>
            </div>
          </div>
        )}

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden mb-6">
          {/* Estado actual */}
          <div className={`${STATUS_BG[shipment.status]} px-6 py-5 text-white`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm opacity-80">Estado actual</p>
                <p className="text-xl font-bold">{STATUS_LABELS[shipment.status]}</p>
              </div>
            </div>

            {/* Barra de progreso */}
            {progress > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs opacity-70 mt-1">
                  <span>Recibido</span>
                  <span>En tránsito</span>
                  <span>En ruta</span>
                  <span>Entregado</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            {/* Datos del envío */}
            <div className="mb-6">
              <p className="text-xs text-gray-500 mb-1">Número de guía</p>
              <p className="font-mono text-lg font-bold text-gray-900">{shipment.guideNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p className="text-xs text-gray-500">Destinatario</p>
                <p className="font-medium text-gray-900">{shipment.recipientName}</p>
              </div>
              {shipment.destination && (
                <div>
                  <p className="text-xs text-gray-500">Destino</p>
                  <p className="font-medium text-gray-900">
                    {shipment.destination.city}, {shipment.destination.state}
                  </p>
                </div>
              )}
              {shipment.deliveredAt && (
                <div>
                  <p className="text-xs text-gray-500">Entregado</p>
                  <p className="font-medium text-gray-900">
                    {new Date(shipment.deliveredAt).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">Historial de movimientos</h3>
              </div>
              <div className="space-y-3">
                {[...shipment.events].reverse().map((event: any, i: number, arr: any[]) => {
                  const EventIcon = STATUS_ICONS[event.status] ?? Package
                  return (
                    <div key={event.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${
                          i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <EventIcon className="w-3.5 h-3.5" />
                        </div>
                        {i < arr.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-3" />}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className={`text-sm font-medium ${i === 0 ? 'text-blue-700' : 'text-gray-700'}`}>
                          {STATUS_LABELS[event.status] ?? event.status}
                        </p>
                        <p className="text-xs text-gray-500">{event.description}</p>
                        {event.location && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {event.location}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(event.createdAt).toLocaleString('es-MX', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-blue-200">
          Servicio de logística EE.UU. — México · {shipment.agency?.name}
        </p>
      </div>
    </div>
  )
}
