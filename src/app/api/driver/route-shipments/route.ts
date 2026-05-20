import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'DRIVER') return NextResponse.json({ error: 'Solo choferes' }, { status: 403 })

  const shipments = await prisma.shipment.findMany({
    where: {
      assignedDriverId: user.id,
      status: { in: ['RECEIVED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED'] },
    },
    include: { destination: true, agency: true },
    orderBy: { updatedAt: 'desc' },
  })

  const delivered = await prisma.shipment.count({
    where: {
      assignedDriverId: user.id,
      status: 'DELIVERED',
      updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  })

  return NextResponse.json({ shipments, deliveredToday: delivered })
}
