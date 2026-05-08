import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code)

    if (session?.user) {
      const { id: supabaseId, email, user_metadata } = session.user

      // Busca por supabaseId o email (para vincular usuarios pre-existentes)
      let user = await prisma.user.findFirst({
        where: { OR: [{ supabaseId }, { email: email ?? '' }] },
      })

      if (!user && email) {
        user = await prisma.user.create({
          data: {
            supabaseId,
            email,
            name: user_metadata?.full_name ?? email.split('@')[0],
            role: 'AGENCY',
          },
        })
      } else if (user && !user.supabaseId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { supabaseId },
        })
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
