import { useState, useEffect, useCallback } from "react";

const DEFAULT_CENTER = { lat: 1.3521, lng: 103.8198 };

// Module-level singleton promise to prevent duplicate <script> tags
let scriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow retry on failure
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function useGoogleMap() {
  const [mapElement, setMapElement] = useState<HTMLDivElement | null>(null);
  const mapRef = useCallback((node: HTMLDivElement | null) => {
    setMapElement(node);
  }, []);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the Google Maps script
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setIsLoaded(true))
      .catch((err) => setError(err.message));
  }, []);

  // Initialize the map once script is loaded and DOM element is available
  useEffect(() => {
    if (!isLoaded || !mapElement) return;

    const newMap = new google.maps.Map(mapElement, {
      center: DEFAULT_CENTER,
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });
    const newInfoWindow = new google.maps.InfoWindow();

    setMap(newMap);
    setInfoWindow(newInfoWindow);

    return () => {
      (google.maps.event as any).clearInstanceListeners?.(newMap);
      newInfoWindow.close();
      setMap(null);
      setInfoWindow(null);
    };
  }, [isLoaded, mapElement]);

  return {
    mapRef,
    map,
    infoWindow,
    isLoaded,
    error,
  };
}
