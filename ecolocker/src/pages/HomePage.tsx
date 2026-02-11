import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createRoot } from "react-dom/client";
import {
  MapPin,
  Clock,
  Box,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { lockerApi } from "../services/locker-api";
import { getCurrentPosition } from "../services/capacitor";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage } from "../utils/network";
import type { Locker } from "../types";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

// Load Google Maps script
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

// InfoWindow content component
function LockerInfoContent({ locker }: { locker: Locker }) {
  return (
    <div className="min-w-[200px] p-1">
      <h3 className="font-semibold text-gray-900">{locker.name}</h3>
      <p className="text-sm text-gray-600">{locker.address}</p>
      <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
        <Box className="h-4 w-4" />
        {locker.availableCompartments}/{locker.totalCompartments} available
      </div>
      {locker.operatingHours && (
        <div className="flex items-center gap-2 text-sm mt-1 text-gray-700">
          <Clock className="h-4 w-4" />
          {locker.operatingHours}
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { listingId } = useAuth();
  const { addToast } = useToast();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Google Maps refs
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  // Singapore center coordinates
  const defaultCenter = { lat: 1.3521, lng: 103.8198 };

  useEffect(() => {
    // If we have a pending listing ID, redirect to selection page
    if (listingId) {
      navigate(`/select-locker?listingId=${listingId}`);
      localStorage.removeItem("ecolocker_pending_listing");
      return;
    }

    // Get user's location using Capacitor hybrid geolocation
    getCurrentPosition().then((location) => {
      setUserLocation(location);
    });

    loadLockers();
  }, [listingId, navigate]);

  // Load Google Maps
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapLoadError("Google Maps API key not configured");
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setIsMapLoaded(true))
      .catch((err) => setMapLoadError(err.message));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || googleMapRef.current) return;

    const mapCenter = userLocation || defaultCenter;

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });

    infoWindowRef.current = new google.maps.InfoWindow();
  }, [isMapLoaded, userLocation]);

  // Update map center when user location changes
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    if (userLocation) {
      googleMapRef.current.panTo(userLocation);
      googleMapRef.current.setZoom(12);

      // Show user location marker (blue circle)
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition(userLocation);
        userMarkerRef.current.setMap(googleMapRef.current);
      } else {
        userMarkerRef.current = new google.maps.Marker({
          position: userLocation,
          map: googleMapRef.current,
          title: "Your Location",
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="#ffffff"/></svg>'),
          },
        });
      }
    }
  }, [userLocation, isMapLoaded]);

  // Update locker markers
  const updateMarkers = useCallback(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    lockers.forEach((locker) => {
      const coords = parseCoordinates(locker.coordinates);

      const marker = new google.maps.Marker({
        position: coords,
        map: googleMapRef.current,
        title: locker.name,
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !googleMapRef.current) return;

        const container = document.createElement("div");
        const root = createRoot(container);
        root.render(<LockerInfoContent locker={locker} />);

        infoWindowRef.current.setContent(container);
        infoWindowRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  }, [lockers, isMapLoaded]);

  useEffect(() => {
    if (isMapLoaded) {
      updateMarkers();
    }
  }, [updateMarkers, isMapLoaded]);

  async function loadLockers() {
    try {
      setLoading(true);
      const data = await lockerApi.getAll();
      setLockers(data);
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }

  function parseCoordinates(coordString: string): { lat: number; lng: number } {
    const [lat, lng] = coordString.split(",").map((s) => parseFloat(s.trim()));
    return { lat, lng };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mapLoadError) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <p className="text-foreground font-medium">Failed to load Google Maps</p>
          <p className="text-sm text-muted-foreground mt-1">{mapLoadError}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-semibold">EcoLocker Network</h1>
        <p className="text-sm text-muted-foreground">
          {lockers.length} locker stations across Singapore
        </p>
      </div>

      {/* Retry button if no lockers loaded */}
      {!loading && lockers.length === 0 && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-muted text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Unable to load lockers
          </p>
          <Button variant="outline" size="sm" onClick={loadLockers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {!isMapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Info card */}
      <Card className="m-4">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">How to use EcoLocker</h3>
              <p className="text-sm text-muted-foreground">
                Select a locker when purchasing items on EcoPlate marketplace
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              EcoPlate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
