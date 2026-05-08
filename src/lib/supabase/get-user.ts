import { createClient } from './server'
import { prisma } from '@/lib/prisma'

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user: sbUser } } = await supabase.auth.getUser()
  if (!sbUser) return null

  const user = await prisma.user.findUnique({
    where: { supabaseId: sbUser.id },
    include: { agency: true },
  })

  return user
}
