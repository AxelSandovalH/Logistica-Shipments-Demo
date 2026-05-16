'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, RefreshCw, Trash2 } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS, PACKAGE_TYPES } from '@/lib/utils'

const STATUSES = ['', 'RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setIsAdmin(d.role === 'ADMIN'))
  }, [])

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    const res = await fetch(`/api/shipments?${params}`)
    const data = await res.json()
    setShipments(data.shipments ?? [])
    setTotal(data.total ?? 0)
    setPages(data.pages ?? 1)
    setLoading(false)
  }, [page, search, status])

  useEffect(() => { fetchShipments() }, [fetchShipments])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchShipments()
  }

  async function handleDelete(id: string, guideNumber: string) {
    if (!confirm(`¿Eliminar el envío ${guideNumber}? Esta acción no se puede deshacer.`)) return
    setDeletingId(id)
    await fetch(`/api/shipments/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    fetchShipments()
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Envíos</h1>
          <p className="text-sm text-gray-500">{total} envíos en total</p>
        </div>
        <Link href="/dashboard/shipments/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo envío
        </Link>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar por guía, remitente o destinatario..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-auto min-w-40" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s ? STATUS_LABELS[s] : 'Todos los estados'}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            <Filter className="w-4 h-4" />
            Filtrar
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setSearch(''); setStatus(''); setPage(1) }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Guía</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Destinatario</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Destino</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">Cargando...</td></tr>
              ) : shipments.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">No se encontraron envíos</td></tr>
              ) : (
                shipments.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-blue-700 font-medium">{s.guideNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.recipientName}</p>
                      {s.recipientPhone && <p className="text-xs text-gray-400">{s.recipientPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.destination ? `${s.destination.city}, ${s.destination.state}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {PACKAGE_TYPES[s.packageType] ?? s.packageType}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_COLORS[s.status]}`}>
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(s.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link href={`/dashboard/shipments/${s.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                          Ver →
                        </Link>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(s.id, s.guideNumber)}
                            disabled={deletingId === s.id}
                            className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                            title="Eliminar envío"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Página {page} de {pages}</p>
            <div className="flex gap-2">
              <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                Anterior
              </button>
              <button className="btn-secondary !py-1 !px-3 text-xs" onClick={() => setPage(p => p + 1)} disabled={page === pages}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
