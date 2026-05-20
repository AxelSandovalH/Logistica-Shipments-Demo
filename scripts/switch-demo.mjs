/**
 * switch-demo.mjs
 * Cambia el webhook de Ultramsg al proyecto que quieras.
 *
 * Uso:
 *   node scripts/switch-demo.mjs hurryops
 *   node scripts/switch-demo.mjs miproyecto
 *   node scripts/switch-demo.mjs              ← muestra cuál está activo
 */

const INSTANCE = 'instance173093'
const TOKEN    = 'syk5qy4kn6wbcby4'
const BASE     = `https://api.ultramsg.com/${INSTANCE}`

// ── Agrega aquí tus proyectos ──────────────────────────────────────────────
const DEMOS = {
  hurryops:    'https://hurryops.app/api/whatsapp',
  // proyecto2: 'https://miproyecto.vercel.app/api/whatsapp',
  // proyecto3: 'https://otro.vercel.app/api/whatsapp',
}
// ──────────────────────────────────────────────────────────────────────────

const target = process.argv[2]

// Sin argumento → mostrar webhook actual
if (!target) {
  const res  = await fetch(`${BASE}/instance/settings?token=${TOKEN}`)
  const data = await res.json()
  console.log('\n📡 Webhook actual:', data.webhook_url ?? '(no configurado)')
  console.log('\nProyectos disponibles:')
  Object.entries(DEMOS).forEach(([key, url]) => {
    const active = data.webhook_url === url ? ' ← activo' : ''
    console.log(`  ${key.padEnd(14)} → ${url}${active}`)
  })
  console.log('\nUso: node scripts/switch-demo.mjs <proyecto>\n')
  process.exit(0)
}

const url = DEMOS[target]
if (!url) {
  console.error(`\n❌ Proyecto "${target}" no encontrado.`)
  console.error('Disponibles:', Object.keys(DEMOS).join(', '))
  process.exit(1)
}

const params = new URLSearchParams({ token: TOKEN, webhook_url: url })
const res = await fetch(`${BASE}/instance/settings`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body:    params.toString(),
})

const data = await res.json()

if (res.ok && !data.error) {
  console.log(`\n✅ Webhook cambiado a: ${target}`)
  console.log(`   ${url}\n`)
} else {
  console.error('\n❌ Error al cambiar webhook:', JSON.stringify(data))
  process.exit(1)
}
