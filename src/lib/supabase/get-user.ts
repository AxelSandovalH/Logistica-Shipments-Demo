import { createClient } from './server'
import { prisma } from '@/lib/prisma'

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user: sbUser } } = await supabase.auth.getUser()
  if (!sbUser) return null

  let user = await prisma.user.findUnique({
    where: { supabaseId: sbUser.id },
    include: { agency: true },
  })

  // Usuario autenticado en Supabase pero sin registro en nuestra BD
  // (se registró desde hurryops.com u otro flujo que no pasó por /auth/callback)
  // → lo creamos automáticamente como PENDING
  if (!user) {
    // Verificar si ya existe por email (creado manualmente por admin antes del registro)
    const byEmail = await prisma.user.findUnique({
      where: { email: sbUser.email ?? '' },
      include: { agency: true },
    })

    if (byEmail) {
      // Vincular supabaseId al registro existente
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseId: sbUser.id },
        include: { agency: true },
      })
    } else {
      // Nuevo usuario auto-registrado → PENDING hasta que el admin apruebe
      user = await prisma.user.create({
        data: {
          supabaseId: sbUser.id,
          email: sbUser.email ?? '',
          name: sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? 'Usuario',
          role: 'AGENCY',
          status: 'PENDING',
          active: false,
        },
        include: { agency: true },
      })
    }
  }

  return user
}
