import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const user = await prisma.user.findUnique({ where: { email: 'axesan917@gmail.com' } })
if (!user) { console.log('Usuario no encontrado'); await prisma.$disconnect(); process.exit() }

// Eliminar eventos de tracking de sus envíos
const shipments = await prisma.shipment.findMany({ where: { createdById: user.id }, select: { id: true, guideNumber: true } })
console.log(`Eliminando ${shipments.length} envíos de Axel Sandoval...`)

for (const s of shipments) {
  await prisma.trackingEvent.deleteMany({ where: { shipmentId: s.id } })
  await prisma.shipment.delete({ where: { id: s.id } })
  console.log(' ✅', s.guideNumber)
}

console.log('\nListo — perfil limpio.')
await prisma.$disconnect()
