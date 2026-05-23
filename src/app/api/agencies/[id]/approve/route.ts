import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { sendOnboardingApprovedEmail } from '@/lib/email'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const agency = await prisma.agency.findUnique({
    where: { id: params.id },
    include: { users: true },
  })
  if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 })

  // Activar agencia y todos sus usuarios pendientes
  await prisma.$transaction([
    prisma.agency.update({
      where: { id: params.id },
      data: { status: 'ACTIVE', active: true },
    }),
    prisma.user.updateMany({
      where: { agencyId: params.id, status: 'PENDING' },
      data: { status: 'ACTIVE', active: true },
    }),
  ])

  // Email de bienvenida al contacto principal
  const contactUser = agency.users[0]
  if (contactUser?.email && agency.contactName) {
    sendOnboardingApprovedEmail({
      to:          contactUser.email,
      contactName: agency.contactName,
      agencyName:  agency.name,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
