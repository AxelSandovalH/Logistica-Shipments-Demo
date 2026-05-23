import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { z } from 'zod'
import crypto from 'crypto'

const InviteSchema = z.object({
  name:  z.string().min(2),
  email: z.string().email(),
  role:  z.enum(['AGENCY', 'DRIVER']),
})

// GET — listar equipo de la agencia
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['ADMIN', 'AGENCY'].includes(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const agencyId = user.role === 'ADMIN' ? undefined : user.agencyId ?? undefined

  const members = await prisma.user.findMany({
    where: {
      ...(agencyId ? { agencyId } : {}),
      role: { in: ['AGENCY', 'DRIVER'] },
    },
    select: {
      id: true, name: true, email: true, role: true,
      status: true, active: true, createdAt: true,
      inviteToken: true, inviteExpiry: true,
      agency: { select: { name: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ members })
}

// POST — invitar nuevo miembro
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!['ADMIN', 'AGENCY'].includes(user.role)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const agencyId = user.role === 'ADMIN' ? (await req.json().then(b => b.agencyId).catch(() => null)) : user.agencyId
  if (!agencyId) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  const { name, email, role } = parsed.data

  // Verificar que el email no exista
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })

  const agency = await prisma.agency.findUnique({ where: { id: agencyId } })
  if (!agency) return NextResponse.json({ error: 'Agencia no encontrada' }, { status: 404 })

  // Generar token único
  const inviteToken  = crypto.randomBytes(32).toString('hex')
  const inviteExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h

  await prisma.user.create({
    data: {
      name, email, role,
      status: 'PENDING',
      active: false,
      agencyId,
      inviteToken,
      inviteExpiry,
    },
  })

  const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://hurryops.app'}/invite/${inviteToken}`

  await sendTeamInviteEmail({
    to: email, name, agencyName: agency.name,
    role, inviteUrl,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}
