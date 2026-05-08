import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { Package, TruckIcon, CheckCircle, AlertCircle } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/utils'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const where = user.role === 'ADMIN' ? {} : { agencyId: user.agencyId ?? '' }

  const [total, inTransit, delivered, failed, recent] = await Promise.all([
    prisma.shipment.count({ where }),
    prisma.shipment.count({ where: { ...where, status: 'IN_TRANSIT' } }),
    prisma.shipment.count({ where: { ...where, status: 'DELIVERED' } }),
    prisma.shipment.count({ where: { ...where, status: 'FAILED' } }),
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { agency: true, destination: true },
    }),
  ])

  const stats = [
    { label: 'Total Envíos', value: total, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'En Tránsito', value: inTransit, icon: TruckIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Entregados', value: delivered, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Intentos Fallidos', value: failed, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const statusColors: Record<string, string> = {
    RECEIVED: 'bg-blue-100 text-blue-800',
    IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
    OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800',
    DELIVERED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    RETURNED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {user.name}</h1>
        <p className="text-gray-500 mt-1">
          {user.role === 'ADMIN' ? 'Vista general del sistema' : `Portal ${user.agency?.name}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${bg}`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Envíos Recientes</h2>
          <a href="/dashboard/shipments" className="text-sm text-blue-600 hover:underline">Ver todos →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-500">Guía</th>
                <th className="pb-3 text-left font-medium text-gray-500">Destinatario</th>
                <th className="pb-3 text-left font-medium text-gray-500">Destino</th>
                {user.role === 'ADMIN' && <th className="pb-3 text-left font-medium text-gray-500">Agencia</th>}
                <th className="pb-3 text-left font-medium text-gray-500">Estado</th>
                <th className="pb-3 text-left font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recent.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="py-3">
                    <a href={`/dashboard/shipments/${s.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                      {s.guideNumber}
                    </a>
                  </td>
                  <td className="py-3 text-gray-900">{s.recipientName}</td>
                  <td className="py-3 text-gray-500">
                    {s.destination ? `${s.destination.city}, ${s.destination.state}` : '—'}
                  </td>
                  {user.role === 'ADMIN' && <td className="py-3 text-gray-500">{s.agency.name}</td>}
                  <td className="py-3">
                    <span className={`badge ${statusColors[s.status]}`}>{STATUS_LABELS[s.status] ?? s.status}</span>
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(s.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No hay envíos aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
