import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { loadGoogleMapsScript, isGoogleMapsConfigured } from '../../utils/googleMaps';

interface LocationPreviewMapProps {
  coordinates?: { latitude: number; longitude: number };
  height?: string;
}

/**
 * A simple map preview component that shows a single marker at the given coordinates.
 * Updates in real-time when coordinates change.
 */
export function LocationPreviewMap({
  coordinates,
  height = '200px',
}: LocationPreviewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setLoadError("Google Maps API key not configured");
      return;
    }

    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch((err) => setLoadError(err.message));
  }, []);

  // Initialize or update map when coordinates change
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !coordinates) return;

    const position = {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
    };

    // Initialize map if not already created
    if (!googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: position,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        scrollwheel: false,
        gestureHandling: 'cooperative',
      });
    } else {
      // Pan to new position
      googleMapRef.current.panTo(position);
    }

    // Update or create marker
    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map: googleMapRef.current,
        animation: google.maps.Animation.DROP,
      });
    }
  }, [isLoaded, coordinates]);

  // Clean up marker when coordinates are cleared
  useEffect(() => {
    if (!coordinates && markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [coordinates]);

  // Show placeholder when no coordinates
  if (!coordinates) {
    return (
      <div
        className="rounded-xl bg-muted border border-border flex flex-col items-center justify-center"
        style={{ height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center px-4">
          Select a location above to see it on the map
        </p>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div
        className="rounded-xl bg-muted border border-border flex flex-col items-center justify-center"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground text-center px-4">
          Unable to load map preview
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="rounded-xl border border-border overflow-hidden"
      style={{ height }}
    />
  );
}
