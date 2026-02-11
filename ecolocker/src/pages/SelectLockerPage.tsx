import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createRoot } from "react-dom/client";
import {
  MapPin,
  Navigation,
  Clock,
  Box,
  Loader2,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { lockerApi, marketplaceApi, orderApi } from "../services/locker-api";
import { getCurrentPosition } from "../services/capacitor";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage } from "../utils/network";
import type { Locker, Listing } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatPrice } from "@/lib/utils";

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

// Green marker SVG for selected locker
const GREEN_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path fill="#22c55e" stroke="#15803d" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
  <circle fill="#ffffff" cx="12.5" cy="12.5" r="5"/>
</svg>`;

// Red marker SVG for default locker
const RED_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path fill="#ef4444" stroke="#b91c1c" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
  <circle fill="#ffffff" cx="12.5" cy="12.5" r="5"/>
</svg>`;

// InfoWindow content component
function LockerInfoContent({
  locker,
  onSelect,
}: {
  locker: Locker;
  onSelect: () => void;
}) {
  return (
    <div className="min-w-[200px] p-1">
      <h3 className="font-semibold text-gray-900">{locker.name}</h3>
      <p className="text-sm text-gray-600">{locker.address}</p>
      <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
        <Box className="h-4 w-4" />
        {locker.availableCompartments}/{locker.totalCompartments} available
      </div>
      <button
        onClick={onSelect}
        className="mt-3 w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
      >
        Select This Locker
      </button>
    </div>
  );
}

export function SelectLockerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get("listingId");
  const { addToast } = useToast();

  const [lockers, setLockers] = useState<Locker[]>([]);
  const [listing, setListing] = useState<(Listing & { seller: { id: number; name: string } }) | null>(null);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Google Maps refs
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  // Singapore center coordinates
  const defaultCenter = { lat: 1.3521, lng: 103.8198 };

  useEffect(() => {
    // Get user's location using Capacitor hybrid geolocation
    getCurrentPosition().then((location) => {
      setUserLocation(location);
    });

    loadData();
  }, [listingId]);

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
      googleMapRef.current.setZoom(13);

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

  // Handle locker selection
  const handleSelectLocker = useCallback((locker: Locker) => {
    // Update the previous selected marker back to red
    if (selectedLocker) {
      const prevMarker = markersRef.current.get(selectedLocker.id);
      if (prevMarker) {
        prevMarker.setIcon({
          url: "data:image/svg+xml," + encodeURIComponent(RED_MARKER_SVG),
          scaledSize: new google.maps.Size(25, 41),
          anchor: new google.maps.Point(12, 41),
        });
      }
    }

    // Update the new selected marker to green
    const newMarker = markersRef.current.get(locker.id);
    if (newMarker) {
      newMarker.setIcon({
        url: "data:image/svg+xml," + encodeURIComponent(GREEN_MARKER_SVG),
        scaledSize: new google.maps.Size(25, 41),
        anchor: new google.maps.Point(12, 41),
      });
    }

    setSelectedLocker(locker);
    infoWindowRef.current?.close();
  }, [selectedLocker]);

  // Update locker markers
  const updateMarkers = useCallback(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    // Add new markers
    lockers.forEach((locker) => {
      const coords = parseCoordinates(locker.coordinates);
      const isSelected = selectedLocker?.id === locker.id;

      const marker = new google.maps.Marker({
        position: coords,
        map: googleMapRef.current,
        title: locker.name,
        icon: {
          url: "data:image/svg+xml," + encodeURIComponent(isSelected ? GREEN_MARKER_SVG : RED_MARKER_SVG),
          scaledSize: new google.maps.Size(25, 41),
          anchor: new google.maps.Point(12, 41),
        },
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !googleMapRef.current) return;

        const container = document.createElement("div");
        const root = createRoot(container);
        root.render(
          <LockerInfoContent
            locker={locker}
            onSelect={() => handleSelectLocker(locker)}
          />
        );

        infoWindowRef.current.setContent(container);
        infoWindowRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.set(locker.id, marker);
    });
  }, [lockers, isMapLoaded, selectedLocker?.id, handleSelectLocker]);

  useEffect(() => {
    if (isMapLoaded && lockers.length > 0) {
      updateMarkers();
    }
  }, [updateMarkers, isMapLoaded, lockers]);

  async function loadData() {
    try {
      setLoading(true);
      const lockersData = await lockerApi.getAll();
      setLockers(lockersData);

      if (listingId) {
        const listingData = await marketplaceApi.getListing(parseInt(listingId, 10));
        setListing(listingData);
      }
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

  async function handleCreateOrder() {
    if (!selectedLocker || !listingId) return;

    setCreating(true);

    try {
      const order = await orderApi.create(parseInt(listingId, 10), selectedLocker.id);
      navigate(`/payment/${order.id}`);
    } catch (err) {
      addToast(getErrorMessage(err), "error");
    } finally {
      setCreating(false);
    }
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
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-xl font-semibold">Select Pickup Locker</h1>
        {listing && (
          <p className="text-sm text-muted-foreground mt-1">
            For: {listing.title} ({formatPrice(listing.price || 0)})
          </p>
        )}
      </div>

      {/* Retry button if no lockers loaded */}
      {!loading && lockers.length === 0 && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-muted text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Unable to load lockers
          </p>
          <Button variant="outline" size="sm" onClick={loadData}>
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

      {/* Selected locker card */}
      {selectedLocker && (
        <Card className="m-4 border-primary">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{selectedLocker.name}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {selectedLocker.address}
                </p>
              </div>
              <Badge
                variant={
                  selectedLocker.availableCompartments > 0 ? "success" : "destructive"
                }
              >
                {selectedLocker.availableCompartments > 0 ? "Available" : "Full"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Box className="h-4 w-4" />
                {selectedLocker.availableCompartments}/{selectedLocker.totalCompartments}
              </div>
              {selectedLocker.operatingHours && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {selectedLocker.operatingHours}
                </div>
              )}
            </div>

            {listing && (
              <div className="bg-muted rounded-xl p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Item Price</span>
                  <span>{formatPrice(listing.price || 0)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Delivery Fee</span>
                  <span>{formatPrice(2.0)}</span>
                </div>
                <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-border">
                  <span>Total</span>
                  <span>{formatPrice((listing.price || 0) + 2.0)}</span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={
                creating ||
                selectedLocker.availableCompartments === 0 ||
                !listingId
              }
              onClick={handleCreateOrder}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" />
                  Reserve This Locker
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {!selectedLocker && (
        <div className="p-4 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a locker on the map</p>
        </div>
      )}
    </div>
  );
}
