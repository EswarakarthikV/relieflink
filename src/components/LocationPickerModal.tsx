import { useState, useMemo, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MapPin, Loader2, Search, Crosshair } from 'lucide-react'

// Fix the Leaflet marker icon bug (known issue)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const PUNE_COORDS = { lat: 18.5204, lng: 73.8567 }

interface NominatimPlace {
  place_id: number | string
  display_name: string
  lat: string
  lon: string
}

function truncateText(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (address: string, lat: number, lng: number) => void
  initialLat?: number
  initialLng?: number
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

function MapViewController({
  targetView,
}: {
  targetView: { lat: number; lng: number; zoom: number; key: number } | null
}) {
  const map = useMap()
  useEffect(() => {
    if (targetView) {
      map.setView([targetView.lat, targetView.lng], targetView.zoom)
    }
  }, [targetView, map])
  return null
}

function DraggableMarker({
  position,
  setPosition,
}: {
  position: { lat: number; lng: number }
  setPosition: (pos: { lat: number; lng: number }) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([position.lat, position.lng])
    }
  }, [position.lat, position.lng])

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current
        if (marker != null) {
          const latLng = marker.getLatLng()
          setPosition({ lat: latLng.lat, lng: latLng.lng })
        }
      },
    }),
    [setPosition],
  )

  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      ref={markerRef}
    />
  )
}

/**
 * Clean place name by filtering out raw administrative ward/zone tokens
 * (e.g. "Ward 37", "Ward 51", "East Zone") while preserving the actual location,
 * locality, and city.
 */
export function cleanPlaceDisplayName(rawDisplayName: string): string {
  if (!rawDisplayName) return ''
  const parts = rawDisplayName.split(',').map(s => s.trim()).filter(Boolean)
  // Filter out standalone administrative wards or zones unless there are no other parts
  const meaningful = parts.filter(p => !/^(ward|zone)\s*\d+/i.test(p) && !/^\d+\s*(ward|zone)/i.test(p))
  const candidate = meaningful.length > 0 ? meaningful : parts

  // Deduplicate consecutive or identical components (e.g. "Coimbatore, Coimbatore")
  const deduped: string[] = []
  for (const item of candidate) {
    if (!deduped.some(existing => existing.toLowerCase() === item.toLowerCase())) {
      deduped.push(item)
    }
  }

  // Remove country ('India') if we have at least 2 other components
  const finalParts = (deduped.length > 2 && deduped[deduped.length - 1] === 'India')
    ? deduped.slice(0, -1)
    : deduped

  return finalParts.slice(0, 3).join(', ')
}

export async function reverseGeocodeNominatim(lat: number, lng: number, returnFullDisplayName = false): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'ReliefLink/1.0',
        },
      },
    )
    if (!res.ok) throw new Error('Geocoding request failed')
    const data = await res.json()

    if (returnFullDisplayName) {
      if (data.display_name) {
        return cleanPlaceDisplayName(data.display_name) || data.display_name
      }
      throw new Error('No display_name returned')
    }

    // Try structured address fields, ensuring we avoid generic administrative wards as the locality
    if (data.address) {
      const rawLocality =
        data.address.amenity ||
        data.address.building ||
        data.address.commercial ||
        data.address.suburb ||
        data.address.neighbourhood ||
        data.address.quarter ||
        data.address.residential ||
        data.address.road

      // Avoid using "Ward XX" as the locality if a specific road or neighbourhood exists or if cleaned display_name is better
      const isWard = rawLocality && (/^(ward|zone)\s*\d+/i.test(rawLocality) || /^\d+\s*(ward|zone)/i.test(rawLocality))
      const locality = isWard ? (data.address.road || data.address.neighbourhood || undefined) : rawLocality

      const city =
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.county ||
        data.address.district

      const state = data.address.state

      const parts = [locality, city, state].filter(Boolean)
      if (parts.length >= 2) {
        return parts.join(', ')
      }
    }

    if (data.display_name) {
      return cleanPlaceDisplayName(data.display_name)
    }
  } catch (err) {
    if (returnFullDisplayName) {
      throw err
    }
    console.warn('Reverse geocoding error:', err)
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

export function LocationPickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: LocationPickerModalProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number }>(() => ({
    lat: initialLat || PUNE_COORDS.lat,
    lng: initialLng || PUNE_COORDS.lng,
  }))
  const [isConfirming, setIsConfirming] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimPlace[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [targetView, setTargetView] = useState<{ lat: number; lng: number; zoom: number; key: number } | null>(null)
  // Track specifically chosen search result place name so reverse geocoding doesn't overwrite it
  const [selectedPlaceName, setSelectedPlaceName] = useState<string | null>(null)

  const mapRef = useRef<L.Map | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Reset position & search state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition({
        lat: initialLat || PUNE_COORDS.lat,
        lng: initialLng || PUNE_COORDS.lng,
      })
      setIsConfirming(false)
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)
      setSearchError(null)
      setTargetView(null)
      setSelectedPlaceName(null)
    }
  }, [isOpen, initialLat, initialLng])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectResult = (place: NominatimPlace) => {
    const lat = parseFloat(place.lat)
    const lng = parseFloat(place.lon)
    if (!isNaN(lat) && !isNaN(lng)) {
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 16)
      }
      setPosition({ lat, lng })
      setTargetView({ lat, lng, zoom: 16, key: Date.now() })
      const cleanName = cleanPlaceDisplayName(place.display_name)
      setSelectedPlaceName(cleanName)
      setSearchQuery(truncateText(cleanName, 60))
      setShowDropdown(false)
    }
  }

  const handlePositionChange = (pos: { lat: number; lng: number }) => {
    setPosition(pos)
    // If the user manually drags the pin away from the searched place, clear the forced place name
    setSelectedPlaceName(null)
  }

  const handleSearch = async (isEnterKey = false) => {
    const query = searchQuery.trim()
    if (!query) return

    // If dropdown is already open with results and user pressed Enter without clicking
    if (isEnterKey && showDropdown && searchResults.length > 0) {
      handleSelectResult(searchResults[0])
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ReliefLink/1.0',
          },
        },
      )
      if (!res.ok) throw new Error('Search failed')
      const data: NominatimPlace[] = await res.json()
      setSearchResults(data)

      if (isEnterKey && data.length > 0) {
        // On Enter without clicking a result: use the first result
        handleSelectResult(data[0])
      } else {
        if (data.length === 0) {
          setSearchError('No places found')
        }
        setShowDropdown(true)
      }
    } catch (err) {
      console.warn('Place search error:', err)
      setSearchError('Search failed. Please try again.')
      setShowDropdown(true)
    } finally {
      setIsSearching(false)
    }
  }

  const [isLocatingCurrent, setIsLocatingCurrent] = useState(false)

  const handleLocateCurrent = () => {
    if (!navigator.geolocation) return
    setIsLocatingCurrent(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingCurrent(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setPosition({ lat, lng })
        setTargetView({ lat, lng, zoom: 16, key: Date.now() })
        setSelectedPlaceName(null)
      },
      () => {
        setIsLocatingCurrent(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(true)
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      // 1. If user selected a specific named search result, PRESERVE that place name!
      let finalAddress = selectedPlaceName
      if (!finalAddress) {
        finalAddress = await reverseGeocodeNominatim(position.lat, position.lng)
      }
      onConfirm(finalAddress, position.lat, position.lng)
      onClose()
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pick on map"
      maxWidth="max-w-lg"
    >
      <div className="space-y-3.5">
        <p className="text-caption text-ink-muted -mt-2">
          Search for an address or drag the pin to set the relief request location.
        </p>

        {/* Search Bar */}
        <div ref={searchContainerRef} className="relative z-30">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-ink-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!showDropdown && searchResults.length > 0) {
                  setShowDropdown(true)
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search for a place or address"
              className="w-full h-[44px] pl-10 pr-20 rounded-lg bg-white border border-slate-300 text-body text-ink placeholder:text-ink-muted transition-all focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <button
              type="button"
              onClick={() => handleSearch(false)}
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1.5 h-8 px-3 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Search'
              )}
            </button>
          </div>

          {/* Results Dropdown */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-[1000] max-h-60 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((place, idx) => (
                  <button
                    key={place.place_id || idx}
                    type="button"
                    onClick={() => handleSelectResult(place)}
                    className="w-full text-left px-3.5 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                    <span className="text-caption text-ink truncate">
                      {truncateText(place.display_name, 60)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3.5 py-2.5 text-caption text-ink-muted">
                  {searchError || 'No places found'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="h-[300px] w-full rounded-input overflow-hidden border border-slate-200 relative shadow-inner z-10">
          {isOpen && (
            <MapContainer
              ref={mapRef}
              center={[position.lat, position.lng]}
              zoom={13}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapResizer />
              <MapViewController targetView={targetView} />
              <DraggableMarker position={position} setPosition={handlePositionChange} />
            </MapContainer>
          )}

          <button
            type="button"
            onClick={handleLocateCurrent}
            disabled={isLocatingCurrent}
            title="Use my current GPS location"
            className="absolute right-3 top-3 z-[400] bg-white/95 hover:bg-white active:bg-slate-100 text-ink border border-slate-300 rounded-lg shadow-md px-2.5 py-1.5 text-[12px] font-semibold flex items-center gap-1.5 transition-all"
          >
            {isLocatingCurrent ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-brand-600" />
            )}
            <span>Locate me</span>
          </button>
        </div>

        {/* Coordinates status badge */}
        <div className="flex items-center justify-between text-[12px] bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-input">
          <div className="flex items-center gap-1.5 text-ink-muted">
            <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="font-mono text-ink">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </span>
          </div>
          <span className="text-ink-muted truncate max-w-[200px]">
            {selectedPlaceName ? truncateText(selectedPlaceName, 30) : 'GPS Pin'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="min-w-[170px]"
          >
            {isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                <span>Geocoding…</span>
              </>
            ) : (
              'Confirm this location'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export { LocationPickerModal as MapPickerModal }

