import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json({ role: user.role, agencyId: user.agencyId, name: user.name })
}
