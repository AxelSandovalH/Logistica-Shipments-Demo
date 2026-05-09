import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'AGENCY', 'DRIVER']).optional(),
  agencyId: z.string().nullable().optional(),
  active: z.boolean().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (currentUser.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: params.id } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Al aprobar un usuario PENDING → activarlo también
  const isApproving = parsed.data.status === 'ACTIVE' && target.status === 'PENDING'
  const effectiveActive = isApproving ? true : parsed.data.active

  // Sincronizar estado activo/inactivo con Supabase Auth
  if (target.supabaseId) {
    const shouldBan = effectiveActive === false || parsed.data.status === 'INACTIVE'
    const shouldUnban = effectiveActive === true || isApproving
    if (shouldBan) {
      await supabaseAdmin.auth.admin.updateUserById(target.supabaseId, { ban_duration: '876600h' })
    } else if (shouldUnban) {
      await supabaseAdmin.auth.admin.updateUserById(target.supabaseId, { ban_duration: 'none' })
    }
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name && { name: parsed.data.name }),
      ...(parsed.data.role && { role: parsed.data.role }),
      ...('agencyId' in parsed.data && { agencyId: parsed.data.agencyId }),
      ...(typeof effectiveActive === 'boolean' && { active: effectiveActive }),
      ...(parsed.data.status && { status: parsed.data.status }),
    },
    include: { agency: true },
  })

  return NextResponse.json({ user: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (currentUser.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const target = await prisma.user.findUnique({ where: { id: params.id } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Eliminar de Supabase Auth primero
  if (target.supabaseId) {
    await supabaseAdmin.auth.admin.deleteUser(target.supabaseId)
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
