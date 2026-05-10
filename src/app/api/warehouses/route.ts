import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  name:  z.string().min(1),
  city:  z.string().min(1),
  state: z.string().min(1),
  pin:   z.string().min(4).max(8).regex(/^\d+$/, 'El PIN solo puede contener números'),
  notes: z.string().optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { events: true } } },
  })
  return NextResponse.json({ warehouses })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const warehouse = await prisma.warehouse.create({ data: parsed.data })
    return NextResponse.json({ warehouse }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'El PIN ya está en uso por otra bodega' }, { status: 400 })
  }
}
