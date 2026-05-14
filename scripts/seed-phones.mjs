import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Axel — guardar con el 1 intermedio que usa WhatsApp México
  const axel = await prisma.user.update({
    where: { email: 'axesan917@gmail.com' },
    data: { whatsappPhone: '523122265985', role: 'ADMIN', active: true, status: 'ACTIVE' },
  })
  console.log('✅ Axel:', axel.name, '→', axel.whatsappPhone, '| rol:', axel.role)

  // Ramiro
  const ramiro = await prisma.user.upsert({
    where: { email: 'trillonesougi@gmail.com' },
    update: { name: 'Ramiro', role: 'ADMIN', active: true, status: 'ACTIVE', whatsappPhone: '525646295354' },
    create: { email: 'trillonesougi@gmail.com', name: 'Ramiro', role: 'ADMIN', active: true, status: 'ACTIVE', whatsappPhone: '525646295354' },
  })
  console.log('✅ Ramiro:', ramiro.name, '→', ramiro.whatsappPhone, '| rol:', ramiro.role)
}

main().catch(console.error).finally(() => prisma.$disconnect())
