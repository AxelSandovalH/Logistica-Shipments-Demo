import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

// PATCH — activar / desactivar miembro
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser()
  if (!admin || !['ADMIN', 'AGENCY'].includes(admin.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const member = await prisma.user.findUnique({ where: { id: params.id } })
  if (!member) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // AGENCY solo puede gestionar su propia agencia
  if (admin.role === 'AGENCY' && member.agencyId !== admin.agencyId) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const { active } = await req.json()

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      active,
      status: active ? 'ACTIVE' : 'INACTIVE',
    },
  })

  return NextResponse.json({ member: updated })
}

// DELETE — eliminar miembro (solo si no tiene envíos asignados)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser()
  if (!admin || !['ADMIN', 'AGENCY'].includes(admin.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const member = await prisma.user.findUnique({
    where: { id: params.id },
    include: { _count: { select: { assignedShipments: true } } },
  })
  if (!member) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (admin.role === 'AGENCY' && member.agencyId !== admin.agencyId) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }
  if (member._count.assignedShipments > 0) {
    return NextResponse.json({ error: 'El usuario tiene envíos asignados, desactívalo en su lugar' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
