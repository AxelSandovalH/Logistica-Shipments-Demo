import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const guide = 'MNZX-20260514-89248'
  const shipment = await prisma.shipment.findUnique({
    where: { guideNumber: guide },
    select: { id: true, guideNumber: true, status: true, recipientName: true }
  })
  if (shipment) {
    console.log('✅ Guía encontrada:', JSON.stringify(shipment, null, 2))
  } else {
    console.log('❌ Guía NO existe en la base de datos:', guide)
  }

  // Mostrar las últimas 5 guías
  const recent = await prisma.shipment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { guideNumber: true, recipientName: true, createdAt: true }
  })
  console.log('\nÚltimas guías:')
  recent.forEach(s => console.log(' •', s.guideNumber, '-', s.recipientName))
}

main().catch(console.error).finally(() => prisma.$disconnect())
