import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOnboardingRequestEmail, sendOnboardingAdminEmail } from '@/lib/email'
import { z } from 'zod'

const Schema = z.object({
  agencyName:  z.string().min(2),
  agencyCode:  z.string().min(2).max(8).regex(/^[A-Z0-9]+$/, 'Solo mayúsculas y números'),
  contactName: z.string().min(2),
  email:       z.string().email(),
  phone:       z.string().optional(),
  city:        z.string().optional(),
  state:       z.string().optional(),
  website:     z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { agencyName, agencyCode, contactName, email, phone, city, state, website } = parsed.data

  // Verificar duplicados
  const [codeExists, emailExists] = await Promise.all([
    prisma.agency.findUnique({ where: { code: agencyCode } }),
    prisma.user.findUnique({ where: { email } }),
  ])

  if (codeExists) return NextResponse.json({ error: 'El código de agencia ya está en uso' }, { status: 409 })
  if (emailExists) return NextResponse.json({ error: 'Ya existe una cuenta con ese correo' }, { status: 409 })

  // Crear agencia pendiente + usuario pendiente en una transacción
  const agency = await prisma.$transaction(async tx => {
    const ag = await tx.agency.create({
      data: {
        name:        agencyName,
        code:        agencyCode.toUpperCase(),
        email,
        phone:       phone || null,
        contactName,
        city:        city || null,
        state:       state || null,
        website:     website || null,
        status:      'PENDING',
        active:      false,
      },
    })

    await tx.user.create({
      data: {
        email,
        name:     contactName,
        role:     'AGENCY',
        status:   'PENDING',
        active:   false,
        agencyId: ag.id,
      },
    })

    return ag
  })

  // Emails (no bloqueantes)
  sendOnboardingRequestEmail({ to: email, contactName, agencyName }).catch(console.error)
  sendOnboardingAdminEmail({ agencyName, contactName, email, phone, city, state, agencyId: agency.id }).catch(console.error)

  return NextResponse.json({ ok: true, agencyId: agency.id })
}
