import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useGeolocation } from "../../hooks/useGeolocation";
import { filterListingsByRadius } from "../../utils/distance";
import { ListingMapCard } from "../../components/marketplace/ListingMapCard";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { List, Map as MapIcon, Loader2, MapPin, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createRoot } from "react-dom/client";
import type { MarketplaceListingWithDistance } from "../../types/marketplace";

interface MarketplaceMapProps {
  listings?: MarketplaceListingWithDistance[];
  loading?: boolean;
  onToggleView?: () => void;
}

// Default center (Singapore) - only used for initial map view when no listings
const DEFAULT_CENTER = { lat: 1.3521, lng: 103.8198 };

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

export default function MarketplaceMap({
  listings = [],
  loading = false,
  onToggleView,
}: MarketplaceMapProps) {
  const navigate = useNavigate();
  const {
    coordinates: userLocation,
    loading: geoLoading,
    error: geoError,
    getCurrentPosition,
    requestPermission,
    clearError,
  } = useGeolocation();

  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter listings by radius only if user location is available
  const displayListings = useMemo(() => {
    const listingsWithCoords = listings.filter((l) => l.coordinates);

    // If no user location, show all listings
    if (!userLocation) {
      return listingsWithCoords;
    }

    // Filter by radius when location is available
    return filterListingsByRadius(listingsWithCoords, userLocation, radiusKm);
  }, [listings, userLocation, radiusKm]);

  // Load Google Maps
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError("Google Maps API key not configured");
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setIsLoaded(true))
      .catch((err) => setLoadError(err.message));
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || googleMapRef.current) return;

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });

    infoWindowRef.current = new google.maps.InfoWindow();
  }, [isLoaded]);

  // Fit map to show all listings when no user location
  const fitMapToListings = useCallback(() => {
    if (!googleMapRef.current || displayListings.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    displayListings.forEach((listing) => {
      if (listing.coordinates) {
        bounds.extend({
          lat: listing.coordinates.latitude,
          lng: listing.coordinates.longitude,
        });
      }
    });

    googleMapRef.current.fitBounds(bounds);

    // Don't zoom in too much for single listing
    const listener = google.maps.event.addListener(googleMapRef.current, "idle", () => {
      const zoom = googleMapRef.current?.getZoom();
      if (zoom && zoom > 15) {
        googleMapRef.current?.setZoom(15);
      }
      google.maps.event.removeListener(listener);
    });
  }, [displayListings]);

  // Update map view based on location availability
  useEffect(() => {
    if (!googleMapRef.current || !isLoaded) return;

    if (userLocation) {
      // Pan to user location
      googleMapRef.current.panTo({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      });
      googleMapRef.current.setZoom(13);

      // Show user marker
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition({
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        });
        userMarkerRef.current.setMap(googleMapRef.current);
      } else {
        userMarkerRef.current = new google.maps.Marker({
          position: {
            lat: userLocation.latitude,
            lng: userLocation.longitude,
          },
          map: googleMapRef.current,
          title: "Your Location",
          icon: {
            url: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="#ffffff"/></svg>'),
          },
        });
      }

      // Show radius circle
      if (circleRef.current) {
        circleRef.current.setCenter({
          lat: userLocation.latitude,
          lng: userLocation.longitude,
        });
        circleRef.current.setRadius(radiusKm * 1000);
        circleRef.current.setMap(googleMapRef.current);
      } else {
        circleRef.current = new google.maps.Circle({
          map: googleMapRef.current,
          center: {
            lat: userLocation.latitude,
            lng: userLocation.longitude,
          },
          radius: radiusKm * 1000,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
        });
      }
    } else {
      // No location - hide user marker and circle, fit to all listings
      userMarkerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      fitMapToListings();
    }
  }, [userLocation, radiusKm, isLoaded, fitMapToListings]);

  // Update radius circle when radius changes
  useEffect(() => {
    if (circleRef.current && userLocation) {
      circleRef.current.setRadius(radiusKm * 1000);
    }
  }, [radiusKm, userLocation]);

  // Update listing markers
  const updateMarkers = useCallback(() => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add new markers
    displayListings.forEach((listing) => {
      if (!listing.coordinates) return;

      const marker = new google.maps.Marker({
        position: {
          lat: listing.coordinates.latitude,
          lng: listing.coordinates.longitude,
        },
        map: googleMapRef.current,
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !googleMapRef.current) return;

        const container = document.createElement("div");
        const root = createRoot(container);
        root.render(
          <ListingMapCard
            listing={listing}
            onViewDetails={() => navigate(`/marketplace/${listing.id}`)}
          />
        );

        infoWindowRef.current.setContent(container);
        infoWindowRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  }, [displayListings, navigate]);

  useEffect(() => {
    if (isLoaded) {
      updateMarkers();
    }
  }, [updateMarkers, isLoaded]);

  // Request location on mount
  useEffect(() => {
    const initLocation = async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        await getCurrentPosition();
      }
    };

    initLocation();
  }, [requestPermission, getCurrentPosition]);

  const handleGetLocation = async () => {
    clearError();
    const hasPermission = await requestPermission();
    if (hasPermission) {
      await getCurrentPosition();
    }
  };

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <p className="text-foreground font-medium">Failed to load Google Maps</p>
          <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <Card className="p-4 mb-4 space-y-4">
        {/* Radius slider - only show when location is available */}
        {userLocation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="radius" className="text-sm font-medium">
                Search Radius
              </Label>
              <span className="text-sm font-semibold text-primary">{radiusKm} km</span>
            </div>
            <input
              id="radius"
              type="range"
              min="1"
              max="20"
              step="1"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 km</span>
              <span>20 km</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleGetLocation}
            variant={userLocation ? "outline" : "default"}
            size="sm"
            disabled={geoLoading}
            className="flex-1 sm:flex-none"
          >
            {geoLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Getting location...</span>
                <span className="sm:hidden">Loading...</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">{userLocation ? "Update Location" : "Enable Location"}</span>
                <span className="sm:hidden">Location</span>
              </>
            )}
          </Button>

          {onToggleView && (
            <Button onClick={onToggleView} variant="outline" size="sm" className="flex-1 sm:flex-none">
              <List className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">List View</span>
              <span className="sm:hidden">List</span>
            </Button>
          )}
        </div>

        {/* Location Error - simplified */}
        {geoError && (
          <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <p>Location unavailable - showing all listings</p>
            </div>
          </div>
        )}

        {/* Listings Count */}
        <div className="text-sm text-muted-foreground">
          {userLocation ? (
            <>
              Showing {displayListings.length} listing{displayListings.length !== 1 ? "s" : ""} within {radiusKm}km
            </>
          ) : (
            <>
              Showing all {displayListings.length} listing{displayListings.length !== 1 ? "s" : ""}
            </>
          )}
        </div>
      </Card>

      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border">
        {(loading || !isLoaded) && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: "500px" }} />
      </div>

      {/* No listings message */}
      {!loading && isLoaded && displayListings.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Card className="p-6 text-center pointer-events-auto">
            <MapIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-foreground">No listings found</p>
            {userLocation && (
              <p className="text-sm text-muted-foreground mt-1">
                Try increasing the radius
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
