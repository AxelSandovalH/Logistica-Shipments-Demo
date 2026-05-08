'use client'
import { useEffect, useRef } from 'react'

interface AddressResult {
  street: string
  city: string
  state: string
  zip: string
  colonia?: string
}

interface Props {
  placeholder?: string
  country: 'mx' | 'us'
  className?: string
  value: string
  onChange: (value: string) => void
  onSelect: (result: AddressResult) => void
}

declare global {
  interface Window { google: any; initGooglePlaces: () => void }
}

let scriptLoaded = false
let scriptLoading = false
const callbacks: (() => void)[] = []

function loadGoogleMaps(apiKey: string, cb: () => void) {
  if (scriptLoaded) { cb(); return }
  callbacks.push(cb)
  if (scriptLoading) return
  scriptLoading = true
  window.initGooglePlaces = () => {
    scriptLoaded = true
    callbacks.forEach(fn => fn())
    callbacks.length = 0
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces&language=es`
  script.async = true
  document.head.appendChild(script)
}

export function AddressAutocomplete({ placeholder, country, className, value, onChange, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!

  useEffect(() => {
    loadGoogleMaps(apiKey, () => {
      if (!inputRef.current || autocompleteRef.current) return
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country },
        fields: ['address_components', 'formatted_address'],
        types: ['address'],
      })
      autocompleteRef.current = ac
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (!place.address_components) return

        const get = (type: string) =>
          place.address_components.find((c: any) => c.types.includes(type))

        const streetNumber = get('street_number')?.long_name ?? ''
        const route = get('route')?.long_name ?? ''
        const colonia = get('sublocality_level_1')?.long_name ?? get('neighborhood')?.long_name ?? ''
        const city = get('locality')?.long_name ?? get('administrative_area_level_2')?.long_name ?? ''
        const state = get('administrative_area_level_1')?.long_name ?? ''
        const zip = get('postal_code')?.long_name ?? ''

        const street = [route, streetNumber].filter(Boolean).join(' ')
        onChange(street)
        onSelect({ street, city, state, zip, colonia })
      })
    })
  }, [apiKey, country])

  return (
    <input
      ref={inputRef}
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}
