import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { Sidebar } from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} agencyName={user.agency?.name} userName={user.name} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
