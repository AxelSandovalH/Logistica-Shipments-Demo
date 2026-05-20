import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { DashboardShell } from '@/components/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Usuario pendiente de aprobación → pantalla de espera
  // (excluimos la propia ruta /pending para evitar loop)
  if (user.status === 'PENDING') redirect('/pending')

  // Los choferes van directo a su app — no al dashboard
  if (user.role === 'DRIVER') redirect('/driver')

  return (
    <DashboardShell role={user.role} agencyName={user.agency?.name} userName={user.name}>
      {children}
    </DashboardShell>
  )
}
