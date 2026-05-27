import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

// POST — save subscription
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const subscription = await req.json()
  if (!subscription?.endpoint) return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: subscription },
  })

  return NextResponse.json({ ok: true })
}

// DELETE — remove subscription (logout or permission revoked)
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await prisma.user.update({
    where: { id: user.id },
    data: { pushSubscription: undefined },
  })

  return NextResponse.json({ ok: true })
}
