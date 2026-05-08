const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const agency = await prisma.agency.findFirst({ where: { code: 'MNZX' } })
  if (!agency) { console.log('Agencia MNZX no encontrada'); return }

  const user = await prisma.user.update({
    where: { email: 'axesan917@gmail.com' },
    data: { role: 'AGENCY', agencyId: agency.id },
  })
  console.log('Actualizado:', user.email, '-', user.role, '- Agencia:', agency.name)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
