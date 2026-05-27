import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/supabase/get-user'
import { prisma } from '@/lib/prisma'

// ── Haversine distance in km ──────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Nominatim geocode ─────────────────────────────────────────────────────────
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
    const res  = await fetch(url, { headers: { 'User-Agent': 'HurryOps/1.0 (noreply@hurryops.app)' } })
    const data = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// ── Nearest-neighbor TSP ──────────────────────────────────────────────────────
function nearestNeighbor<T extends { lat: number | null; lng: number | null }>(
  items: T[],
  startLat: number,
  startLng: number,
): T[] {
  const withCoords = items.filter(i => i.lat !== null && i.lng !== null)
  const noCoords   = items.filter(i => i.lat === null || i.lng === null)

  const result: T[] = []
  const remaining   = [...withCoords]
  let curLat = startLat
  let curLng = startLng

  while (remaining.length > 0) {
    let nearestIdx = 0
    let minDist    = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(curLat, curLng, remaining[i].lat!, remaining[i].lng!)
      if (d < minDist) { minDist = d; nearestIdx = i }
    }

    const nearest = remaining.splice(nearestIdx, 1)[0]
    result.push(nearest)
    curLat = nearest.lat!
    curLng = nearest.lng!
  }

  // Items without coords go at the end
  return [...result, ...noCoords]
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'DRIVER') return NextResponse.json({ error: 'Solo choferes' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const driverLat = parseFloat(searchParams.get('lat') ?? 'NaN')
  const driverLng = parseFloat(searchParams.get('lng') ?? 'NaN')

  const shipments = await prisma.shipment.findMany({
    where: {
      assignedDriverId: user.id,
      status: { in: ['OUT_FOR_DELIVERY', 'FAILED'] },
    },
    include: { destination: true },
    orderBy: { createdAt: 'asc' },
  })

  if (shipments.length <= 1) {
    return NextResponse.json({ shipments, optimized: false, totalKm: 0 })
  }

  // ── Geocode missing addresses (sequentially, 1.1s apart for Nominatim ToS) ──
  for (const s of shipments) {
    if (!s.destination) continue
    if (s.destination.lat !== null && s.destination.lng !== null) continue

    const query = [
      s.destination.street,
      s.destination.colonia,
      s.destination.city,
      s.destination.state,
      'México',
    ].filter(Boolean).join(', ')

    const coords = await geocode(query)
    if (coords) {
      await prisma.address.update({
        where: { id: s.destination.id },
        data: { lat: coords.lat, lng: coords.lng },
      })
      s.destination.lat = coords.lat
      s.destination.lng = coords.lng
    }

    // Respect Nominatim rate limit: max 1 req/s
    await new Promise(r => setTimeout(r, 1100))
  }

  // ── Build sortable items ──────────────────────────────────────────────────
  const items = shipments.map(s => ({
    ...s,
    lat: s.destination?.lat ?? null,
    lng: s.destination?.lng ?? null,
  }))

  const startLat = !isNaN(driverLat) ? driverLat : (items[0]?.lat ?? 0)
  const startLng = !isNaN(driverLng) ? driverLng : (items[0]?.lng ?? 0)

  const optimized = nearestNeighbor(items, startLat, startLng)

  // ── Calculate total estimated distance ───────────────────────────────────
  let totalKm  = 0
  let prevLat  = startLat
  let prevLng  = startLng
  const withDist = optimized.map(s => {
    const dist = (s.lat && s.lng)
      ? haversine(prevLat, prevLng, s.lat, s.lng)
      : 0
    if (s.lat && s.lng) { prevLat = s.lat; prevLng = s.lng }
    totalKm += dist
    return { ...s, distKm: Math.round(dist * 10) / 10 }
  })

  return NextResponse.json({
    shipments: withDist,
    optimized: true,
    totalKm: Math.round(totalKm * 10) / 10,
  })
}
