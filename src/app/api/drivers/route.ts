import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const where: any = { role: 'DRIVER', active: true }
  if (user.role !== 'ADMIN') where.agencyId = user.agencyId

  const drivers = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, agencyId: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ drivers })
}
