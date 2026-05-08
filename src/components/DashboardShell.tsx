'use client'
import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Menu, X } from 'lucide-react'

interface Props {
  role: string
  agencyName?: string | null
  userName?: string | null
  children: React.ReactNode
}

export function DashboardShell({ role, agencyName, userName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <div className="hidden md:flex">
        <Sidebar role={role} agencyName={agencyName} userName={userName} />
      </div>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 z-50">
            <Sidebar role={role} agencyName={agencyName} userName={userName} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header móvil */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-blue-900 text-white sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm">HurryOps</span>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
