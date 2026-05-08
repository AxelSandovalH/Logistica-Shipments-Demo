'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'

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

export function AddressAutocomplete({ placeholder, country, className, value, onChange, onSelect }: Props) {
  const [predictions, setPredictions] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) { setPredictions([]); return }
    setLoading(true)
    const res = await fetch(`/api/places?input=${encodeURIComponent(input)}&country=${country}`)
    const data = await res.json()
    setPredictions(data.predictions ?? [])
    setOpen(true)
    setLoading(false)
  }, [country])

  function handleChange(val: string) {
    onChange(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(val), 350)
  }

  async function handleSelect(prediction: any) {
    onChange(prediction.structured_formatting?.main_text ?? prediction.description)
    setOpen(false)
    setPredictions([])

    const res = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: prediction.place_id }),
    })
    const data = await res.json()
    if (!data.result?.address_components) return

    const get = (type: string) =>
      data.result.address_components.find((c: any) => c.types.includes(type))

    const streetNumber = get('street_number')?.long_name ?? ''
    const route = get('route')?.long_name ?? ''
    const colonia = get('sublocality_level_1')?.long_name ?? get('neighborhood')?.long_name ?? ''
    const city = get('locality')?.long_name ?? get('administrative_area_level_2')?.long_name ?? ''
    const state = get('administrative_area_level_1')?.long_name ?? ''
    const zip = get('postal_code')?.long_name ?? ''
    const street = [route, streetNumber].filter(Boolean).join(' ')

    onChange(street)
    onSelect({ street, city, state, zip, colonia })
  }

  // Cierra al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className={className}
        placeholder={placeholder ?? 'Escribe para buscar...'}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
      )}
      {open && predictions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto text-sm">
          {predictions.map((p: any) => (
            <li
              key={p.place_id}
              onMouseDown={() => handleSelect(p)}
              className="flex items-start gap-2 px-3 py-2 hover:bg-blue-50 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">{p.structured_formatting?.main_text}</p>
                <p className="text-xs text-gray-400">{p.structured_formatting?.secondary_text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
