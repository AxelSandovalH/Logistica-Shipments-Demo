const { PrismaClient } = require('@prisma/client')
require('dotenv/config')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const agencyAdmin = await prisma.agency.upsert({
    where: { code: 'HURRY' },
    update: {},
    create: { name: 'HurryInn Logistics', code: 'HURRY', email: 'ops@hurryinn.com', phone: '+1 310 000 0001' },
  })

  const agencyMnzx = await prisma.agency.upsert({
    where: { code: 'MNZX' },
    update: {},
    create: { name: 'Manzanillo Express', code: 'MNZX', email: 'ops@manzanilloexpress.com', phone: '+52 314 000 0001' },
  })

  const agencyPacific = await prisma.agency.upsert({
    where: { code: 'PCFC' },
    update: {},
    create: { name: 'Pacific Cargo MX', code: 'PCFC', email: 'info@pacificcargo.mx', phone: '+52 33 0000 0002' },
  })

  // Pre-registrar usuarios por email — supabaseId se llena al primer login con Google
  await prisma.user.upsert({
    where: { email: 'axesan917@gmail.com' },
    update: {},
    create: { email: 'axesan917@gmail.com', name: 'Ramiro Admin', role: 'ADMIN', agencyId: agencyAdmin.id },
  })

  await prisma.user.upsert({
    where: { email: 'ops@manzanilloexpress.com' },
    update: {},
    create: { email: 'ops@manzanilloexpress.com', name: 'Carlos Manzanillo', role: 'AGENCY', agencyId: agencyMnzx.id },
  })

  await prisma.user.upsert({
    where: { email: 'ops@pacificcargo.mx' },
    update: {},
    create: { email: 'ops@pacificcargo.mx', name: 'Ana Pacific', role: 'AGENCY', agencyId: agencyPacific.id },
  })

  const shipments = [
    { guide: 'MNZX-20240507-10001', status: 'DELIVERED', sender: 'Maria Garcia', recipient: 'Jose Lopez', city: 'Manzanillo', state: 'Colima', agencyId: agencyMnzx.id, events: ['RECEIVED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED'] },
    { guide: 'MNZX-20240507-10002', status: 'IN_TRANSIT', sender: 'Roberto Hernandez', recipient: 'Carmen Ruiz', city: 'Guadalajara', state: 'Jalisco', agencyId: agencyMnzx.id, events: ['RECEIVED','IN_TRANSIT'] },
    { guide: 'PCFC-20240507-20001', status: 'OUT_FOR_DELIVERY', sender: 'Linda Torres', recipient: 'Pedro Sanchez', city: 'Ciudad de México', state: 'Ciudad de México', agencyId: agencyPacific.id, events: ['RECEIVED','IN_TRANSIT','OUT_FOR_DELIVERY'] },
    { guide: 'MNZX-20240507-10003', status: 'RECEIVED', sender: 'Ana Martinez', recipient: 'Luis Gonzalez', city: 'Monterrey', state: 'Nuevo León', agencyId: agencyMnzx.id, events: ['RECEIVED'] },
    { guide: 'PCFC-20240507-20002', status: 'FAILED', sender: 'David Wilson', recipient: 'Sofia Morales', city: 'Guadalajara', state: 'Jalisco', agencyId: agencyPacific.id, events: ['RECEIVED','IN_TRANSIT','OUT_FOR_DELIVERY','FAILED'] },
  ]

  const descriptions = {
    RECEIVED: 'Paquete recibido en bodega',
    IN_TRANSIT: 'Paquete en tránsito hacia México',
    OUT_FOR_DELIVERY: 'Paquete en ruta de entrega',
    DELIVERED: 'Paquete entregado al destinatario',
    FAILED: 'Intento de entrega fallido — no había nadie en el domicilio',
  }

  for (const s of shipments) {
    const existing = await prisma.shipment.findUnique({ where: { guideNumber: s.guide } })
    if (existing) continue

    const dest = await prisma.address.create({
      data: { street: 'Calle Ejemplo 123', city: s.city, state: s.state, zip: '28000', country: 'MX' },
    })

    const shipment = await prisma.shipment.create({
      data: {
        guideNumber: s.guide, status: s.status,
        senderName: s.sender, recipientName: s.recipient, recipientPhone: '+52 314 000 0000',
        weight: 2.0, packageType: 'PACKAGE', serviceType: 'STANDARD',
        agencyId: s.agencyId, destinationId: dest.id,
        deliveredAt: s.status === 'DELIVERED' ? new Date() : undefined,
      },
    })

    let date = new Date()
    date.setDate(date.getDate() - s.events.length)
    for (const status of s.events) {
      date = new Date(date.getTime() + 1000 * 60 * 60 * 24)
      await prisma.trackingEvent.create({
        data: { shipmentId: shipment.id, status, description: descriptions[status] || status, createdAt: new Date(date) },
      })
    }
  }

  console.log('✅ Seed completado')
  console.log('   Admin pre-registrado: axesan917@gmail.com')
  console.log('   Inicia sesión con Google y ese email tendrá rol ADMIN automáticamente')
}

main().catch(console.error).finally(() => prisma.$disconnect())
