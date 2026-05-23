import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { sendOnboardingRejectedEmail } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { reason } = await req.json().catch(() => ({}))

  const agency = await prisma.agency.findUnique({
    where: { id: params.id },
    include: { users: true },
  })
  if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 })

  await prisma.$transaction([
    prisma.agency.update({
      where: { id: params.id },
      data: { status: 'SUSPENDED', active: false },
    }),
    prisma.user.updateMany({
      where: { agencyId: params.id },
      data: { status: 'INACTIVE', active: false },
    }),
  ])

  const contactUser = agency.users[0]
  if (contactUser?.email && agency.contactName) {
    sendOnboardingRejectedEmail({
      to:          contactUser.email,
      contactName: agency.contactName,
      agencyName:  agency.name,
      reason,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
