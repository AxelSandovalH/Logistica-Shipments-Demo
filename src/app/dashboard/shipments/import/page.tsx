'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

interface PreviewRow {
  row: number
  nombre_remitente: string
  nombre_destinatario: string
  ciudad_destino: string
  estado_destino: string
  servicio: string
  valid: boolean
  errors: string[]
}

interface ImportResult {
  row: number
  ok: boolean
  guideNumber?: string
  recipientName?: string
  error?: string
}

const REQUIRED = ['nombre_remitente', 'nombre_destinatario', 'calle_destino', 'ciudad_destino', 'estado_destino']

function validateRow(r: Record<string, unknown>, rowNum: number): PreviewRow {
  const norm = (v: unknown) => String(v ?? '').trim()
  const errors: string[] = []
  for (const f of REQUIRED) if (!norm(r[f])) errors.push(f)
  return {
    row: rowNum,
    nombre_remitente:    norm(r['nombre_remitente']),
    nombre_destinatario: norm(r['nombre_destinatario']),
    ciudad_destino:      norm(r['ciudad_destino']),
    estado_destino:      norm(r['estado_destino']),
    servicio:            norm(r['servicio']) || 'STANDARD',
    valid: errors.length === 0,
    errors,
  }
}

export default function ImportPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<PreviewRow[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState<ImportResult[] | null>(null)
  const [summary, setSummary]   = useState<{ created: number; total: number } | null>(null)

  // ── Parse file client-side for preview ────────────────────────────────────
  function handleFile(f: File) {
    setFile(f)
    setResults(null)
    setSummary(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        setPreview(rows.map((r, i) => validateRow(r, i + 2)))
      } catch {
        setPreview([])
      }
    }
    reader.readAsArrayBuffer(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // ── Submit to server ──────────────────────────────────────────────────────
  async function doImport() {
    if (!file) return
    setLoading(true)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/shipments/import', { method: 'POST', body: fd })
    const d = await r.json()
    setLoading(false)
    if (!r.ok) { alert(d.error ?? 'Error al importar'); return }
    setResults(d.results)
    setSummary({ created: d.created, total: d.total })
  }

  const validCount   = preview.filter(r => r.valid).length
  const invalidCount = preview.length - validCount

  // ── Results view ──────────────────────────────────────────────────────────
  if (results) {
    const errors = results.filter(r => !r.ok)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className={`rounded-2xl p-6 mb-6 ${summary!.created === summary!.total ? 'bg-emerald-50 border border-emerald-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${summary!.created === summary!.total ? 'bg-emerald-100' : 'bg-yellow-100'}`}>
              {summary!.created === summary!.total ? '✅' : '⚠️'}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">
                {summary!.created} de {summary!.total} envíos creados
              </p>
              {errors.length > 0 && (
                <p className="text-sm text-yellow-700">{errors.length} filas con errores no se importaron</p>
              )}
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">Filas con error</p>
            </div>
            <div className="divide-y divide-gray-100">
              {errors.map(r => (
                <div key={r.row} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded">Fila {r.row}</span>
                  <span className="text-sm text-gray-600">{r.recipientName || '—'}</span>
                  <span className="text-xs text-red-600 ml-auto">{r.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/shipments')}
            className="flex-1 py-3 rounded-xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors"
          >
            Ver envíos creados
          </button>
          <button
            onClick={() => { setFile(null); setPreview([]); setResults(null); setSummary(null) }}
            className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Nueva importación
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Importación masiva</h1>
        <p className="text-sm text-gray-500 mt-1">Carga múltiples envíos desde un archivo Excel</p>
      </div>

      {/* Download template */}
      <a
        href="/api/shipments/import/template"
        download
        className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6 hover:bg-blue-100 transition-colors group"
      >
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-blue-800 text-sm">Descargar plantilla Excel</p>
          <p className="text-xs text-blue-500">plantilla-hurryops.xlsx · incluye instrucciones y ejemplo</p>
        </div>
        <svg className="w-4 h-4 text-blue-400 ml-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>

      {/* Drop zone */}
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="font-semibold text-gray-700">Arrastra tu archivo aquí</p>
          <p className="text-sm text-gray-400 mt-1">o haz clic para seleccionarlo · .xlsx, .xls, .csv</p>
        </div>
      ) : (
        <>
          {/* File info */}
          <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-4 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{preview.length} filas detectadas · {validCount} válidas{invalidCount > 0 ? ` · ${invalidCount} con errores` : ''}</p>
            </div>
            <button
              onClick={() => { setFile(null); setPreview([]) }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-4">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Vista previa</p>
                <span className="text-xs text-gray-400">{preview.length > 10 ? `Mostrando primeras 10 de ${preview.length}` : `${preview.length} filas`}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5 font-semibold">Fila</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Remitente</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Destinatario</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Destino</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Servicio</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.slice(0, 10).map(r => (
                      <tr key={r.row} className={r.valid ? '' : 'bg-red-50'}>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{r.row}</td>
                        <td className="px-4 py-2.5 text-gray-900 truncate max-w-[140px]">{r.nombre_remitente || <span className="text-red-400 italic">vacío</span>}</td>
                        <td className="px-4 py-2.5 text-gray-900 truncate max-w-[140px]">{r.nombre_destinatario || <span className="text-red-400 italic">vacío</span>}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{[r.ciudad_destino, r.estado_destino].filter(Boolean).join(', ') || <span className="text-red-400 italic">sin destino</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{r.servicio}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.valid
                            ? <span className="text-xs text-emerald-600 font-semibold">✓ OK</span>
                            : <span className="text-xs text-red-600 font-semibold" title={r.errors.join(', ')}>✗ Error</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 10 && (
                <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                  +{preview.length - 10} filas más no mostradas
                </div>
              )}
            </div>
          )}

          {/* Invalid rows warning */}
          {invalidCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-800">
              <strong>{invalidCount} fila{invalidCount > 1 ? 's' : ''}</strong> con campos obligatorios vacíos — se omitirán al importar.
            </div>
          )}

          {/* Import button */}
          <button
            onClick={doImport}
            disabled={loading || validCount === 0}
            className="w-full py-4 rounded-2xl bg-[#1e3a5f] text-white font-bold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando...</>
              : `Importar ${validCount} envío${validCount !== 1 ? 's' : ''}`
            }
          </button>
        </>
      )}
    </div>
  )
}
