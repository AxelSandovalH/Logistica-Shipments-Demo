import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  name:  z.string().min(1),
  code:  z.string().min(2).max(10).toUpperCase(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const agencies = await prisma.agency.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { shipments: true, users: true } } },
  })
  return NextResponse.json({ agencies })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const agency = await prisma.agency.create({
    data: parsed.data,
  })
  return NextResponse.json({ agency }, { status: 201 })
}
