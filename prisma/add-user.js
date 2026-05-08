const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'Trillonesougi@gmail.com' },
    update: { role: 'ADMIN', active: true },
    create: { email: 'Trillonesougi@gmail.com', name: 'Socio', role: 'ADMIN', active: true },
  })
  console.log('Usuario creado:', user.email, '-', user.role)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
