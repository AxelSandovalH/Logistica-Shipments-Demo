'use client'
import { useEffect, useRef } from 'react'

interface Props {
  driverLat: number | null
  driverLng: number | null
  destAddress: string
}

export default function DriverMap({ driverLat, driverLng, destAddress }: Props) {
  const mapRef    = useRef<any>(null)
  const mapElRef  = useRef<HTMLDivElement>(null)
  const driverRef = useRef<any>(null)
  const destRef   = useRef<any>(null)

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return

    // Leaflet solo corre en browser
    import('leaflet').then(L => {
      // Fix default icons (Next.js asset issue)
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const startLat = driverLat ?? 19.4326
      const startLng = driverLng ?? -99.1332

      const map = L.map(mapElRef.current!, {
        zoomControl: false,
        attributionControl: false,
      }).setView([startLat, startLng], 15)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Ícono del chofer — círculo azul
      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:20px;height:20px;border-radius:50%;
          background:#3b82f6;border:3px solid white;
          box-shadow:0 2px 8px rgba(59,130,246,.6);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      // Ícono del destino — pin rojo
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="
            width:28px;height:28px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);background:#ef4444;
            border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,.5);
          "></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      })

      driverRef.current = L.marker([startLat, startLng], { icon: driverIcon })
        .addTo(map)
        .bindPopup('Tu ubicacion')

      mapRef.current = { map, L, driverIcon, destIcon }

      // Geocodificar destino con Nominatim
      if (destAddress) {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destAddress)}&format=json&limit=1&countrycodes=mx`)
          .then(r => r.json())
          .then(data => {
            if (data?.[0]) {
              const lat = parseFloat(data[0].lat)
              const lng = parseFloat(data[0].lon)
              destRef.current = L.marker([lat, lng], { icon: destIcon })
                .addTo(map)
                .bindPopup('Destino de entrega')

              // Ajustar vista para mostrar ambos puntos
              if (driverLat && driverLng) {
                map.fitBounds([[driverLat, driverLng], [lat, lng]], { padding: [40, 40] })
              } else {
                map.setView([lat, lng], 15)
              }
            }
          })
          .catch(() => {})
      }
    })

    return () => {
      if (mapRef.current?.map) {
        mapRef.current.map.remove()
        mapRef.current = null
        driverRef.current = null
        destRef.current = null
      }
    }
  }, [])

  // Actualizar posición del chofer cuando cambia el GPS
  useEffect(() => {
    if (!mapRef.current || driverLat == null || driverLng == null) return
    const { map } = mapRef.current
    if (driverRef.current) {
      driverRef.current.setLatLng([driverLat, driverLng])
    }
    if (!destRef.current) {
      map.setView([driverLat, driverLng], map.getZoom())
    }
  }, [driverLat, driverLng])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
