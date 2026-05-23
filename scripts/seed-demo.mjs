import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

const AGENCY_ID = 'cmoyqj37c000111e1uua83npw' // Manzanillo Express
const DRIVER_ID = 'cmow25v3j0004aq3mnllzicvy' // Axel Sandoval (chofer)
const ADMIN_ID  = '99a984ab-2bcf-4eb4-9c4e-020195ea544d' // asandoval13@ucol.mx
const WH_ID     = 'cmoz88pg90000wcgc0umu0vxe' // Bodega LAX

function guide(n) {
  return 'MNZX-20260520-' + String(n).padStart(5, '0')
}

async function main() {
  console.log('Limpiando datos anteriores...')
  await p.trackingEvent.deleteMany({})
  await p.shipment.deleteMany({})
  await p.address.deleteMany({})

  // Arreglar nombre del admin demo
  await p.user.update({
    where: { email: 'asandoval13@ucol.mx' },
    data: { name: 'Axel Sandoval', agencyId: null },
  })
  console.log('✓ Usuario admin actualizado\n')

  // ── 1. RECEIVED — guía creada, paquete en camino a bodega USA ──────────
  const d1 = await p.address.create({ data: { street: 'Av. Juárez 340', colonia: 'Centro', city: 'Guadalajara', state: 'Jalisco', zip: '44100', country: 'MX' } })
  const o1 = await p.address.create({ data: { street: '1420 S Figueroa St', city: 'Los Angeles', state: 'California', zip: '90015', country: 'US' } })
  const s1 = await p.shipment.create({ data: {
    guideNumber: guide(10001), agencyId: AGENCY_ID,
    status: 'RECEIVED',
    senderName: 'Jennifer Parker', senderPhone: '310 555 0101', senderEmail: 'jennifer@example.com',
    recipientName: 'María López', recipientPhone: '333 100 2001', recipientEmail: 'axesan917@gmail.com', notifyRecipient: true,
    weight: 3.2, packageType: 'PACKAGE', serviceType: 'EXPRESS', pieces: 1, description: 'Electrónica',
    originId: o1.id, destinationId: d1.id, createdById: ADMIN_ID,
  }})
  await p.trackingEvent.create({ data: { shipmentId: s1.id, status: 'RECEIVED', description: 'Guía generada — paquete pendiente de llegada a bodega', createdById: ADMIN_ID } })
  console.log('✓', s1.guideNumber, '— RECEIVED (guía nueva)')

  // ── 2. IN_TRANSIT — salió de bodega USA rumbo a México ─────────────────
  const d2 = await p.address.create({ data: { street: 'Blvd. Francisco Medina Ascencio 2500', colonia: 'Marina Vallarta', city: 'Puerto Vallarta', state: 'Jalisco', zip: '48335', country: 'MX', references: 'Frente al hotel Marriott' } })
  const o2 = await p.address.create({ data: { street: '4025 Camino del Rio S', city: 'San Diego', state: 'California', zip: '92108', country: 'US' } })
  const s2 = await p.shipment.create({ data: {
    guideNumber: guide(10002), agencyId: AGENCY_ID,
    status: 'IN_TRANSIT',
    senderName: 'Michael Torres', senderPhone: '619 555 0202',
    recipientName: 'Roberto Sánchez', recipientPhone: '322 200 3002', recipientEmail: 'axesan917@gmail.com', notifyRecipient: true,
    weight: 1.8, packageType: 'PACKAGE', serviceType: 'STANDARD', pieces: 1, description: 'Ropa y accesorios',
    originId: o2.id, destinationId: d2.id, createdById: ADMIN_ID,
  }})
  await p.trackingEvent.createMany({ data: [
    { shipmentId: s2.id, status: 'RECEIVED', description: 'Paquete recibido en bodega Los Ángeles', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-19T09:00:00Z') },
    { shipmentId: s2.id, status: 'IN_TRANSIT', description: 'Paquete enviado a México — tránsito internacional', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-20T06:00:00Z') },
  ]})
  console.log('✓', s2.guideNumber, '— IN_TRANSIT (en camino a MX)')

  // ── 3. RECEIVED en MX — llegó a bodega México ───────────────────────────
  const d3 = await p.address.create({ data: { street: 'Av. del Mar 340', colonia: 'Centro', city: 'Manzanillo', state: 'Colima', zip: '28200', country: 'MX', references: 'Casa azul, esquina con Calle 5 de Mayo' } })
  const o3 = await p.address.create({ data: { street: '6100 Wilshire Blvd', city: 'Los Angeles', state: 'California', zip: '90048', country: 'US' } })
  const s3 = await p.shipment.create({ data: {
    guideNumber: guide(10003), agencyId: AGENCY_ID,
    status: 'RECEIVED',
    senderName: 'Sarah Johnson', senderPhone: '323 555 0303',
    recipientName: 'Ana García', recipientPhone: '314 300 4003', recipientEmail: 'axesan917@gmail.com', notifyRecipient: true,
    weight: 0.9, packageType: 'ENVELOPE', serviceType: 'EXPRESS', pieces: 1, description: 'Cosméticos y perfumes',
    originId: o3.id, destinationId: d3.id, createdById: ADMIN_ID,
  }})
  await p.trackingEvent.createMany({ data: [
    { shipmentId: s3.id, status: 'RECEIVED', description: 'Recibido en bodega Los Ángeles', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-18T10:00:00Z') },
    { shipmentId: s3.id, status: 'IN_TRANSIT', description: 'En tránsito hacia México', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-19T14:00:00Z') },
    { shipmentId: s3.id, status: 'RECEIVED', description: 'Confirmado en bodega Manzanillo — listo para repartir', createdById: ADMIN_ID, createdAt: new Date('2026-05-20T08:30:00Z') },
  ]})
  console.log('✓', s3.guideNumber, '— RECEIVED (en bodega MX)')

  // ── 4. OUT_FOR_DELIVERY — asignado al chofer ────────────────────────────
  const d4 = await p.address.create({ data: { street: 'Calle Madero 125', colonia: 'Jardines del Valle', city: 'Manzanillo', state: 'Colima', zip: '28219', country: 'MX', references: 'Portón negro, timbrar 2 veces' } })
  const o4 = await p.address.create({ data: { street: '3500 S Figueroa St', city: 'Los Angeles', state: 'California', zip: '90007', country: 'US' } })
  const s4 = await p.shipment.create({ data: {
    guideNumber: guide(10004), agencyId: AGENCY_ID,
    status: 'OUT_FOR_DELIVERY', assignedDriverId: DRIVER_ID,
    senderName: 'Carlos Rivera', senderPhone: '213 555 0404',
    recipientName: 'Luis Hernández', recipientPhone: '314 400 5004', recipientEmail: 'axesan917@gmail.com', notifyRecipient: true,
    weight: 0.3, packageType: 'ENVELOPE', serviceType: 'EXPRESS', pieces: 1, description: 'Documentos legales',
    originId: o4.id, destinationId: d4.id, createdById: ADMIN_ID,
  }})
  await p.trackingEvent.createMany({ data: [
    { shipmentId: s4.id, status: 'RECEIVED', description: 'Recibido en bodega Los Ángeles', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-17T11:00:00Z') },
    { shipmentId: s4.id, status: 'IN_TRANSIT', description: 'En tránsito hacia México', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-18T16:00:00Z') },
    { shipmentId: s4.id, status: 'RECEIVED', description: 'Confirmado en bodega Manzanillo', createdById: ADMIN_ID, createdAt: new Date('2026-05-19T09:00:00Z') },
    { shipmentId: s4.id, status: 'OUT_FOR_DELIVERY', description: 'Asignado a chofer — en ruta de entrega', createdById: ADMIN_ID, createdAt: new Date('2026-05-20T09:00:00Z') },
  ]})
  console.log('✓', s4.guideNumber, '— OUT_FOR_DELIVERY (con chofer)')

  // ── 5. DELIVERED — entregado hoy ────────────────────────────────────────
  const d5 = await p.address.create({ data: { street: 'Blvd. Costero 890', colonia: 'Las Brisas', city: 'Manzanillo', state: 'Colima', zip: '28210', country: 'MX' } })
  const o5 = await p.address.create({ data: { street: '900 Wilshire Blvd', city: 'Los Angeles', state: 'California', zip: '90017', country: 'US' } })
  const s5 = await p.shipment.create({ data: {
    guideNumber: guide(10005), agencyId: AGENCY_ID,
    status: 'DELIVERED', deliveredAt: new Date(), assignedDriverId: DRIVER_ID,
    senderName: 'Amanda White', senderPhone: '310 555 0505',
    recipientName: 'Carmen Flores', recipientPhone: '314 500 6005', recipientEmail: 'axesan917@gmail.com', notifyRecipient: true,
    weight: 0.5, packageType: 'PACKAGE', serviceType: 'EXPRESS', pieces: 1, description: 'Joyería fina',
    originId: o5.id, destinationId: d5.id, createdById: ADMIN_ID,
  }})
  await p.trackingEvent.createMany({ data: [
    { shipmentId: s5.id, status: 'RECEIVED', description: 'Recibido en bodega Los Ángeles', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-16T10:00:00Z') },
    { shipmentId: s5.id, status: 'IN_TRANSIT', description: 'En tránsito hacia México', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-17T15:00:00Z') },
    { shipmentId: s5.id, status: 'RECEIVED', description: 'Confirmado en bodega Manzanillo', createdById: ADMIN_ID, createdAt: new Date('2026-05-18T08:00:00Z') },
    { shipmentId: s5.id, status: 'OUT_FOR_DELIVERY', description: 'En ruta de entrega', createdById: ADMIN_ID, createdAt: new Date('2026-05-19T10:00:00Z') },
    { shipmentId: s5.id, status: 'DELIVERED', description: 'Paquete entregado al destinatario', createdById: ADMIN_ID, createdAt: new Date('2026-05-20T11:30:00Z') },
  ]})
  console.log('✓', s5.guideNumber, '— DELIVERED')

  // ── 6. FAILED — intento fallido, sigue con chofer ───────────────────────
  const d6 = await p.address.create({ data: { street: 'Calle Juárez 45 Int. 3', colonia: 'Pueblo Nuevo', city: 'Manzanillo', state: 'Colima', zip: '28200', country: 'MX', references: 'Edificio blanco, 3er piso, interfón 301' } })
  const o6 = await p.address.create({ data: { street: '2100 S Vermont Ave', city: 'Los Angeles', state: 'California', zip: '90007', country: 'US' } })
  const s6 = await p.shipment.create({ data: {
    guideNumber: guide(10006), agencyId: AGENCY_ID,
    status: 'FAILED', assignedDriverId: DRIVER_ID,
    senderName: 'James Brown', senderPhone: '213 555 0606',
    recipientName: 'Diego Morales', recipientPhone: '314 600 7006', recipientEmail: 'axesan917@gmail.com', notifyRecipient: true,
    weight: 2.1, packageType: 'PACKAGE', serviceType: 'STANDARD', pieces: 2, description: 'Electrónica — laptop',
    originId: o6.id, destinationId: d6.id, createdById: ADMIN_ID,
  }})
  await p.trackingEvent.createMany({ data: [
    { shipmentId: s6.id, status: 'RECEIVED', description: 'Recibido en bodega Los Ángeles', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-18T10:00:00Z') },
    { shipmentId: s6.id, status: 'IN_TRANSIT', description: 'En tránsito hacia México', warehouseId: WH_ID, createdById: ADMIN_ID, createdAt: new Date('2026-05-19T14:00:00Z') },
    { shipmentId: s6.id, status: 'OUT_FOR_DELIVERY', description: 'Asignado a chofer — en ruta de entrega', createdById: ADMIN_ID, createdAt: new Date('2026-05-20T08:00:00Z') },
    { shipmentId: s6.id, status: 'FAILED', description: 'Intento fallido — destinatario no se encontraba en domicilio', createdById: ADMIN_ID, createdAt: new Date('2026-05-20T10:30:00Z') },
  ]})
  console.log('✓', s6.guideNumber, '— FAILED (con chofer)')

  console.log('\n✅  Demo listo. 6 envíos creados.')
  console.log('   Chofer ve en su app: MNZX-20260520-10004 y MNZX-20260520-10006')
}

main().catch(console.error).finally(() => p.$disconnect())
