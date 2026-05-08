import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const input = new URL(req.url).searchParams.get('input')
  const country = new URL(req.url).searchParams.get('country') ?? 'mx'
  if (!input || input.length < 2) return NextResponse.json({ predictions: [] })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:${country}&language=es&types=address&key=${key}`

  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json({ predictions: data.predictions ?? [] })
}

export async function POST(req: NextRequest) {
  const { placeId } = await req.json()
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address&language=es&key=${key}`

  const res = await fetch(url)
  const data = await res.json()
  return NextResponse.json({ result: data.result ?? null })
}
