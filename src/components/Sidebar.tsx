'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, LayoutDashboard, List, Building2, Users, LogOut, TruckIcon, BookUser, X, Warehouse, BarChart2, UserCog, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SidebarProps {
  role: string
  agencyName?: string | null
  userName?: string | null
  onClose?: () => void
}

const adminLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/shipments', label: 'Envíos', icon: List },
  { href: '/dashboard/shipments/new', label: 'Nuevo Envío', icon: Package },
  { href: '/dashboard/clients', label: 'Clientes', icon: BookUser },
  { href: '/dashboard/agencies', label: 'Agencias', icon: Building2 },
  { href: '/dashboard/warehouses', label: 'Bodegas', icon: Warehouse },
  { href: '/dashboard/users', label: 'Usuarios', icon: Users },
  { href: '/dashboard/team', label: 'Equipo', icon: UserCog },
  { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart2 },
]

const agencyLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/shipments', label: 'Mis Envíos', icon: List },
  { href: '/dashboard/shipments/new', label: 'Nuevo Envío', icon: Package },
  { href: '/dashboard/clients', label: 'Clientes', icon: BookUser },
  { href: '/dashboard/team', label: 'Equipo', icon: UserCog },
  { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart2 },
]

const driverLinks = [
  { href: '/dashboard', label: 'Mi Ruta', icon: TruckIcon },
  { href: '/dashboard/shipments', label: 'Envíos', icon: Package },
]

export function Sidebar({ role, agencyName, userName, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const links = role === 'ADMIN' ? adminLinks : role === 'DRIVER' ? driverLinks : agencyLinks

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-blue-900 text-white">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-blue-800">
        <Image src="/logo.png" alt="HurryOps" width={36} height={36} className="rounded-lg flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">HurryOps</p>
          <p className="text-xs text-blue-300 truncate">Logistics</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-blue-300 hover:text-white md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {agencyName && (
        <div className="px-6 py-3 border-b border-blue-800 bg-blue-800/50">
          <p className="text-xs text-blue-300">Agencia</p>
          <p className="text-sm font-medium truncate">{agencyName}</p>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-blue-200 hover:bg-blue-800 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-blue-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-blue-300 truncate">{userName}</p>
          <p className="text-xs text-blue-400">
            {role === 'ADMIN' ? 'Administrador' : role === 'DRIVER' ? 'Chofer' : 'Agencia'}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
