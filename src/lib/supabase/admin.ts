import { createClient } from '@supabase/supabase-js'

// Cliente con service role — solo usar en rutas de API del servidor, nunca en el cliente
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
