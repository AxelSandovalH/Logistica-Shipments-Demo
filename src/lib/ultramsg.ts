const BASE = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE}`
const TOKEN = process.env.ULTRAMSG_TOKEN!

export async function sendWhatsapp(to: string, body: string) {
  await fetch(`${BASE}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, to, body }),
  })
}
