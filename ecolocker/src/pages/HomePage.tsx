import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createRoot } from "react-dom/client";
import {
  MapPin,
  Clock,
  Box,
  Loader2,
  RefreshCw,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import { lockerApi } from "../services/locker-api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage, useOnlineStatus } from "../utils/network";
import { useGoogleMap } from "../hooks/useGoogleMap";
import { useUserLocation } from "../hooks/useUserLocation";
import { useLockerMarkers } from "../hooks/useLockerMarkers";
import type { Locker } from "../types";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

function LockerInfoContent({ locker }: { locker: Locker }) {
  return (
    <div className="min-w-[200px] p-1">
      <h3 className="font-semibold text-foreground">{locker.name}</h3>
      <p className="text-sm text-muted-foreground">{locker.address}</p>
      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
        <Box className="h-4 w-4" />
        {locker.availableCompartments}/{locker.totalCompartments} available
      </div>
      {locker.operatingHours && (
        <div className="flex items-center gap-2 text-sm mt-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          {locker.operatingHours}
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { listingId, clearListingId } = useAuth();
  const { addToast } = useToast();
  const isOnline = useOnlineStatus();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Map hooks — independent lifecycle, no overlapping deps
  const { mapRef, map, infoWindow, isLoaded, error: mapLoadError } = useGoogleMap();
  useUserLocation({ map });

  const renderInfoWindow = useCallback(
    (container: HTMLDivElement, locker: Locker) => {
      const root = createRoot(container);
      root.render(<LockerInfoContent locker={locker} />);
    },
    []
  );

  useLockerMarkers({
    map,
    infoWindow,
    lockers,
    selectable: false,
    onInfoWindowRender: renderInfoWindow,
  });

  // Handle listingId redirect separately from locker loading
  useEffect(() => {
    if (listingId) {
      const id = listingId;
      clearListingId();
      navigate(`/select-locker?listingId=${id}`);
    }
  }, [listingId, clearListingId, navigate]);

  // Load lockers — runs on mount and when not redirecting
  useEffect(() => {
    if (listingId) return;

    let cancelled = false;
    loadLockers(cancelled);
    return () => { cancelled = true; };
  }, [listingId]);

  // Auto-retry loading lockers when coming back online after a failure
  useEffect(() => {
    if (isOnline && loadError && lockers.length === 0) {
      loadLockers(false);
    }
  }, [isOnline]);

  async function loadLockers(cancelled?: boolean) {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await lockerApi.getAll();
      if (cancelled) return;
      setLockers(data);
    } catch (err) {
      if (cancelled) return;
      const message = getErrorMessage(err);
      setLoadError(message);
      addToast(message, "error");
    } finally {
      if (!cancelled) setLoading(false);
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
        <h1 className="text-xl font-semibold">EcoLocker Network</h1>
        <p className="text-sm text-muted-foreground">
          {lockers.length} locker stations across Singapore
        </p>
      </div>

      {/* Error banner with retry — persists until lockers are loaded */}
      {loadError && lockers.length === 0 && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-destructive/10 text-center space-y-3">
          {!isOnline ? (
            <>
              <WifiOff className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">You're offline</p>
              <p className="text-sm text-muted-foreground">
                Lockers will load automatically when you reconnect.
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">{loadError}</p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => loadLockers(false)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {!isLoaded && (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
