import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'AGENCY', 'DRIVER']),
  agencyId: z.string().optional().nullable(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: { agency: true },
  })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Datos inválidos'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { name, email, password, role, agencyId } = parsed.data

  // 1. Verificar que el email no exista ya en Prisma
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })

  // 2. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // confirmar email automáticamente, sin necesidad de verificación
  })

  if (authError || !authData.user) {
    const msg = authError?.message ?? 'Error al crear usuario en autenticación'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const supabaseId = authData.user.id

  // 3. Crear el registro en Prisma vinculado al supabaseId
  try {
    const newUser = await prisma.user.create({
      data: {
        supabaseId,
        name,
        email,
        role,
        agencyId: agencyId || null,
      },
      select: { id: true, name: true, email: true, role: true, active: true, agency: true },
    })
    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (err) {
    // Si Prisma falla, eliminar el usuario de Supabase para no dejar basura
    await supabaseAdmin.auth.admin.deleteUser(supabaseId)
    console.error('[POST /api/users] Prisma error:', err)
    return NextResponse.json({ error: 'Error al guardar el usuario' }, { status: 500 })
  }
}
