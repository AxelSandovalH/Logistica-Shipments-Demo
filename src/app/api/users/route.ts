import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'AGENCY', 'DRIVER']),
  agencyId: z.string().optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: { agency: true },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return NextResponse.json({ error: 'Email ya registrado' }, { status: 409 })

  const newUser = await prisma.user.create({
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  return NextResponse.json({ user: newUser }, { status: 201 })
}
