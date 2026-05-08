import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!

export async function GET(req: NextRequest) {
  const input = new URL(req.url).searchParams.get('input')
  const country = new URL(req.url).searchParams.get('country') ?? 'mx'
  if (!input || input.length < 2) return NextResponse.json({ predictions: [] })

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text',
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: [country],
      languageCode: 'es',
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('[places] API error:', JSON.stringify(data))
    return NextResponse.json({ predictions: [] })
  }

  const predictions = (data.suggestions ?? []).map((s: any) => ({
    place_id: s.placePrediction?.placeId,
    structured_formatting: {
      main_text: s.placePrediction?.structuredFormat?.mainText?.text ?? '',
      secondary_text: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
    },
    description: s.placePrediction?.text?.text ?? '',
  }))

  return NextResponse.json({ predictions })
}

export async function POST(req: NextRequest) {
  const { placeId } = await req.json()

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=es`, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'addressComponents',
    },
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('[places] Details error:', JSON.stringify(data))
    return NextResponse.json({ result: null })
  }

  return NextResponse.json({ result: { address_components: data.addressComponents ?? [] } })
}
