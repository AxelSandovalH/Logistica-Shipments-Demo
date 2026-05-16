import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const warehouses = await prisma.warehouse.findMany({ select: { name: true, city: true, pin: true, active: true } })
warehouses.forEach(w => console.log(`${w.active ? '✅' : '❌'} ${w.name} — ${w.city} | PIN: ${w.pin}`))
await prisma.$disconnect()
