import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — validar token y devolver info del usuario invitado
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const user = await prisma.user.findUnique({
    where: { inviteToken: params.token },
    select: {
      id: true, name: true, email: true, role: true,
      status: true, inviteExpiry: true,
      agency: { select: { name: true } },
    },
  })

  if (!user) return NextResponse.json({ error: 'Invitación no válida o ya usada' }, { status: 404 })
  if (user.status !== 'PENDING') return NextResponse.json({ error: 'Esta invitación ya fue usada' }, { status: 410 })
  if (user.inviteExpiry && user.inviteExpiry < new Date()) {
    return NextResponse.json({ error: 'La invitación ha expirado' }, { status: 410 })
  }

  return NextResponse.json({ user })
}

// POST — aceptar invitación: crear cuenta Supabase + activar usuario
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { inviteToken: params.token },
  })

  if (!dbUser)                              return NextResponse.json({ error: 'Invitación no válida' }, { status: 404 })
  if (dbUser.status !== 'PENDING')          return NextResponse.json({ error: 'Invitación ya usada' }, { status: 410 })
  if (dbUser.inviteExpiry && dbUser.inviteExpiry < new Date()) {
    return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 })
  }

  // Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email:    dbUser.email,
    password,
    email_confirm: true,
  })

  if (authError) {
    console.error('[invite] Supabase error:', authError)
    return NextResponse.json({ error: 'Error al crear la cuenta. Intenta de nuevo.' }, { status: 500 })
  }

  // Activar usuario en nuestra DB
  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      supabaseId:   authData.user.id,
      status:       'ACTIVE',
      active:       true,
      inviteToken:  null,
      inviteExpiry: null,
    },
  })

  return NextResponse.json({ ok: true, email: dbUser.email })
}
