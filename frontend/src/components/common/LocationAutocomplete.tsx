import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

// Load Google Maps script with Places library
function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    const existingScript = document.getElementById("google-maps-places-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-places-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

/**
 * Location autocomplete component using Google Places API
 * Provides address suggestions as user types
 */
export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Enter pickup location',
  label,
  required = false,
  className,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const dummyDivRef = useRef<HTMLDivElement | null>(null);

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => {
        setIsLoaded(true);
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        // PlacesService requires a map or div element
        if (!dummyDivRef.current) {
          dummyDivRef.current = document.createElement('div');
        }
        placesServiceRef.current = new google.maps.places.PlacesService(dummyDivRef.current);
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
      });
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch location suggestions from Google Places
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3 || !autocompleteServiceRef.current) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    try {
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'sg' }, // Limit to Singapore
          types: ['address', 'establishment', 'geocode'],
        },
        (predictions, status) => {
          setLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    } catch (error) {
      console.error('Failed to fetch location suggestions:', error);
      setSuggestions([]);
      setLoading(false);
    }
  }, []);

  // Debounced search
  const handleInputChange = (inputValue: string) => {
    onChange(inputValue);
    setSelectedIndex(-1);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 300); // 300ms delay
  };

  // Handle suggestion selection - get coordinates from place details
  const handleSelectSuggestion = (suggestion: PlacePrediction) => {
    if (!placesServiceRef.current) {
      onChange(suggestion.description);
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    placesServiceRef.current.getDetails(
      {
        placeId: suggestion.place_id,
        fields: ['geometry', 'formatted_address'],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onChange(place.formatted_address || suggestion.description, {
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
        } else {
          onChange(suggestion.description);
        }
        setShowSuggestions(false);
        setSuggestions([]);
        setSelectedIndex(-1);
      }
    );
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {label && (
        <Label htmlFor="location-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="location-input"
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className="pl-10 pr-10"
          required={required}
          disabled={!isLoaded}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border/50 last:border-b-0',
                selectedIndex === index && 'bg-primary/5'
              )}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {suggestion.structured_formatting.main_text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {suggestion.structured_formatting.secondary_text}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && !loading && value.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg p-4">
          <p className="text-sm text-muted-foreground text-center">
            No locations found. Try a different search term.
          </p>
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-muted-foreground mt-1">
        Start typing to search for Singapore addresses or landmarks
      </p>
    </div>
  );
}

// Re-export the interface for backward compatibility
export interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
}
