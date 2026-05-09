import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user: sbUser } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Sin sesión → al login
  if (!sbUser && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Ya autenticado → no volver al login
  if (sbUser && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Verificar status del usuario en BD para rutas del dashboard
  if (sbUser && pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/pending')) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: sbUser.id },
      select: { status: true },
    })

    if (dbUser?.status === 'PENDING') {
      return NextResponse.redirect(new URL('/dashboard/pending', request.url))
    }
  }

  // Evitar que usuarios activos accedan a la página de pendiente
  if (sbUser && pathname.startsWith('/dashboard/pending')) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: sbUser.id },
      select: { status: true },
    })

    if (dbUser?.status !== 'PENDING') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
