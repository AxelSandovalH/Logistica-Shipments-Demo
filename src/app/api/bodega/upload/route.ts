import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const name = `evidence/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('evidence')
    .upload(name, file, { contentType: file.type, upsert: false })

  if (error) {
    console.error('[upload]', error)
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }

  const { data } = supabase.storage.from('evidence').getPublicUrl(name)
  return NextResponse.json({ url: data.publicUrl })
}
