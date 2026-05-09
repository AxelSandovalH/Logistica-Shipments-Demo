import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
})

async function getClientAndVerify(id: string, userId: string, role: string, agencyId: string | null) {
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return { error: 'Cliente no encontrado', status: 404 }
  if (role !== 'ADMIN' && client.agencyId !== agencyId) {
    return { error: 'Sin acceso', status: 403 }
  }
  return { client }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error, status } = await getClientAndVerify(params.id, user.id, user.role, user.agencyId)
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const client = await prisma.client.update({
    where: { id: params.id },
    data: { ...parsed.data, email: parsed.data.email || null },
  })
  return NextResponse.json({ client })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error, status } = await getClientAndVerify(params.id, user.id, user.role, user.agencyId)
  if (error) return NextResponse.json({ error }, { status })

  await prisma.client.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
