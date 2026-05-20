import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateGuideNumber(agencyCode: string): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `${agencyCode.toUpperCase()}-${y}${m}${d}-${rand}`
}

export const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recibido en bodega',
  IN_TRANSIT: 'En tránsito',
  OUT_FOR_DELIVERY: 'En ruta de entrega',
  DELIVERED: 'Entregado',
  FAILED: 'Intento fallido',
  RETURNED: 'Devuelto',
}

/** Devuelve el label más descriptivo posible para RECEIVED,
 *  usando los tracking events para saber si es bodega USA o MX. */
export function getStatusLabel(
  status: string,
  events?: Array<{ status: string; description?: string | null }>,
): string {
  if (status === 'RECEIVED' && events?.length) {
    // Buscar el evento RECEIVED más reciente
    const ev = [...events].reverse().find(e => e.status === 'RECEIVED')
    if (ev?.description?.toLowerCase().includes('méx') || ev?.description?.toLowerCase().includes('mex')) {
      return 'Recibido en bodega MX'
    }
    return 'Recibido en bodega USA'
  }
  return STATUS_LABELS[status] ?? status
}

export const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
  OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-gray-100 text-gray-800',
}

export const PACKAGE_TYPES: Record<string, string> = {
  PACKAGE: 'Paquete',
  ENVELOPE: 'Sobre',
  PALLET: 'Tarima',
}

export const SERVICE_TYPES: Record<string, string> = {
  STANDARD: 'Estándar',
  EXPRESS: 'Express',
  ECONOMY: 'Económico',
}
