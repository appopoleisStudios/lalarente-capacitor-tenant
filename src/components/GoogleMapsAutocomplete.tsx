'use client'

import { useEffect, useRef, useState } from 'react'

// TypeScript declarations for Google Maps
declare global {
  interface Window {
    google: any
    initGoogleMaps: () => void
  }
}

// Google Maps types
interface GooglePlaceResult {
  formatted_address?: string
  address_components?: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
  geometry?: any
  place_id?: string
}


interface GoogleAutocomplete {
  getPlace(): GooglePlaceResult
  addListener(event: string, callback: () => void): void
}


interface GoogleMapsAutocompleteProps {
  value: string
  onChange: (address: string, details?: GooglePlaceResult) => void
  placeholder?: string
  className?: string
  required?: boolean
  disabled?: boolean
}

export default function GoogleMapsAutocomplete({
  value,
  onChange,
  placeholder = "Enter address...",
  className = "",
  required = false,
  disabled = false
}: GoogleMapsAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeGoogleMaps = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        
        if (!apiKey) {
          setError('Google Maps API key not configured')
          return
        }

        // Check if Google Maps is already loaded
        if (window.google && window.google.maps && window.google.maps.places) {
          setIsLoaded(true)
          return
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
          // Wait for existing script to load
          const checkLoaded = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.places) {
              setIsLoaded(true)
              clearInterval(checkLoaded)
            }
          }, 100)
          
          // Clear interval after 10 seconds
          setTimeout(() => clearInterval(checkLoaded), 10000)
          return
        }

        // Load Google Maps API script with new Places API
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&v=weekly`
        script.async = true
        script.defer = true

        // Set up callback
        window.initGoogleMaps = () => {
          setIsLoaded(true)
          setError(null)
        }

        script.onerror = () => {
          setError('Failed to load Google Maps')
        }

        document.head.appendChild(script)
      } catch (err) {
        console.error('Error loading Google Maps:', err)
        setError('Failed to load Google Maps')
      }
    }

    initializeGoogleMaps()
  }, [])

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return

    try {
      // Use legacy Autocomplete for now (required for new projects)
      // TODO: Migrate to new Places API when JavaScript autocomplete is available
      if (window.google && window.google.maps && window.google.maps.places) {
        autocompleteRef.current = new (window.google as any).maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'za' }, // Restrict to South Africa
          fields: ['formatted_address', 'address_components', 'geometry', 'place_id'],
          types: ['address']
        })

        // Listen for place selection
        autocompleteRef.current?.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace()
          
          if (place && place.formatted_address) {
            onChange(place.formatted_address, place)
          }
        })
      } else {
        console.warn('Google Maps Places API not available - using regular input')
        setError('Google Maps autocomplete not available - using regular input')
      }
    } catch (err) {
      console.error('Error initializing autocomplete:', err)
      setError('Failed to initialize address autocomplete - using regular input')
    }
  }, [isLoaded, onChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        (window.google as any).maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  if (error) {
    return (
      <div className="space-y-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600 ${className}`}
          required={required}
          disabled={disabled}
        />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoaded ? placeholder : "Loading address autocomplete..."}
        className={`w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600 ${className}`}
        required={required}
        disabled={disabled || !isLoaded}
      />
      {!isLoaded && (
        <p className="text-sm text-gray-500">Loading Google Maps...</p>
      )}
    </div>
  )
}


// Helper function to extract address components
export function extractAddressComponents(place: GooglePlaceResult) {
  const components = place.address_components || []
  
  let streetNumber = ''
  let route = ''
  let city = ''
  let province = ''
  let postalCode = ''
  let country = ''

  components.forEach((component: any) => {
    const types = component.types
    
    if (types.includes('street_number')) {
      streetNumber = component.long_name
    } else if (types.includes('route')) {
      route = component.long_name
    } else if (types.includes('locality') || types.includes('administrative_area_level_2')) {
      city = component.long_name
    } else if (types.includes('administrative_area_level_1')) {
      province = component.long_name
    } else if (types.includes('postal_code')) {
      postalCode = component.long_name
    } else if (types.includes('country')) {
      country = component.long_name
    }
  })

  return {
    streetNumber,
    route,
    city,
    province,
    postalCode,
    country,
    fullAddress: place.formatted_address || ''
  }
}
