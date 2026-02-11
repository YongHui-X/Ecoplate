import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

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

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

/**
 * Location autocomplete component using OpenStreetMap Nominatim API
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
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

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

  // Fetch location suggestions from Nominatim
  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    try {
      // Nominatim API - free geocoding service from OpenStreetMap
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          new URLSearchParams({
            q: query,
            format: 'json',
            addressdetails: '1',
            countrycodes: 'sg', // Limit to Singapore
            limit: '5',
          }),
        {
          headers: {
            'User-Agent': 'EcoPlate/1.0', // Nominatim requires a user agent
          },
        }
      );

      if (response.ok) {
        const data: LocationSuggestion[] = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Failed to fetch location suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

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

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    onChange(suggestion.display_name, {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    });
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
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

  // Format suggestion display
  const formatSuggestion = (suggestion: LocationSuggestion): string => {
    const parts: string[] = [];
    const addr = suggestion.address;

    if (addr.road) parts.push(addr.road);
    if (addr.neighbourhood || addr.suburb) parts.push(addr.neighbourhood || addr.suburb!);
    if (addr.postcode) parts.push(`Singapore ${addr.postcode}`);

    return parts.length > 0 ? parts.join(', ') : suggestion.display_name;
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
              key={`${suggestion.lat}-${suggestion.lon}`}
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
                    {formatSuggestion(suggestion)}
                  </p>
                  {suggestion.address.postcode && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Postal Code: {suggestion.address.postcode}
                    </p>
                  )}
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
        Start typing to search for Singapore addresses, postal codes, or landmarks
      </p>
    </div>
  );
}
