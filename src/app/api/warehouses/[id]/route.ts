import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const Schema = z.object({
  name:   z.string().min(1).optional(),
  city:   z.string().min(1).optional(),
  state:  z.string().min(1).optional(),
  pin:    z.string().min(4).max(8).regex(/^\d+$/, 'El PIN solo puede contener números').optional(),
  notes:  z.string().optional(),
  active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const warehouse = await prisma.warehouse.update({
      where: { id: params.id },
      data: parsed.data,
    })
    return NextResponse.json({ warehouse })
  } catch {
    return NextResponse.json({ error: 'La bodega no existe o el PIN ya está en uso' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  // Desvincular eventos (no eliminamos eventos de tracking, solo quitamos la referencia)
  await prisma.trackingEvent.updateMany({
    where: { warehouseId: params.id },
    data: { warehouseId: null },
  })

  await prisma.warehouse.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
