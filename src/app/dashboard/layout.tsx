import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { DashboardShell } from '@/components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <DashboardShell role={user.role} agencyName={user.agency?.name} userName={user.name}>
      {children}
    </DashboardShell>
  )
}
