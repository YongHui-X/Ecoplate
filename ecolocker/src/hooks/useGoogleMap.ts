import { useRef, useState, useEffect } from "react";

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
  const mapRef = useRef<HTMLDivElement>(null);
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

  // Initialize the map once script is loaded - does NOT depend on user location
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    setMap(new google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    }));

    setInfoWindow(new google.maps.InfoWindow());
  }, [isLoaded, map]);

  return {
    mapRef,
    map,
    infoWindow,
    isLoaded,
    error,
  };
}
