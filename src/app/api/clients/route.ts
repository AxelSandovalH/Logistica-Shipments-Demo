import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const agencyId = user.role === 'ADMIN'
    ? (new URL(req.url).searchParams.get('agencyId') ?? undefined)
    : user.agencyId!

  const search = new URL(req.url).searchParams.get('search') ?? ''
  const where: any = agencyId ? { agencyId } : {}
  if (search) where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { phone: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ]

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const agencyId = user.role === 'ADMIN' ? (body.agencyId ?? user.agencyId!) : user.agencyId!

  const client = await prisma.client.create({
    data: { ...parsed.data, email: parsed.data.email || null, agencyId },
  })
  return NextResponse.json({ client }, { status: 201 })
}
