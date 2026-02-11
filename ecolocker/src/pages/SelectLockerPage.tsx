import { useState, useEffect, useCallback } from "react";
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
  WifiOff,
} from "lucide-react";
import { lockerApi, marketplaceApi, orderApi } from "../services/locker-api";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage, useOnlineStatus } from "../utils/network";
import { useGoogleMap } from "../hooks/useGoogleMap";
import { useUserLocation } from "../hooks/useUserLocation";
import { useLockerMarkers } from "../hooks/useLockerMarkers";
import type { Locker, Listing } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatPrice } from "@/lib/utils";

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
  const isOnline = useOnlineStatus();

  const [lockers, setLockers] = useState<Locker[]>([]);
  const [listing, setListing] = useState<(Listing & { seller: { id: number; name: string } }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockerError, setLockerError] = useState<string | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Map hooks — independent lifecycle, no overlapping deps
  const { mapRef, map, infoWindow, isLoaded, error: mapLoadError } = useGoogleMap();
  useUserLocation({ map });

  const renderInfoWindow = useCallback(
    (container: HTMLDivElement, locker: Locker, onSelect: () => void) => {
      const root = createRoot(container);
      root.render(<LockerInfoContent locker={locker} onSelect={onSelect} />);
    },
    []
  );

  const { selectedLocker } = useLockerMarkers({
    map,
    infoWindow,
    lockers,
    selectable: true,
    onInfoWindowRender: renderInfoWindow,
  });

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    loadData(cancelled);
    return () => { cancelled = true; };
  }, [listingId]);

  // Auto-retry when coming back online after a locker loading failure
  useEffect(() => {
    if (isOnline && lockerError && lockers.length === 0) {
      loadData(false);
    }
  }, [isOnline]);

  async function loadData(cancelled?: boolean) {
    try {
      setLoading(true);
      setLockerError(null);

      const lockersPromise = lockerApi.getAll();
      const listingPromise = listingId
        ? marketplaceApi.getListing(parseInt(listingId, 10))
        : Promise.resolve(null);

      const [lockersData, listingData] = await Promise.allSettled([
        lockersPromise,
        listingPromise,
      ]);

      if (cancelled) return;

      if (lockersData.status === "fulfilled") {
        setLockers(lockersData.value);
        setLockerError(null);
      } else {
        const message = getErrorMessage(lockersData.reason);
        setLockerError(message);
        addToast(message, "error");
      }

      if (listingData.status === "fulfilled" && listingData.value) {
        setListing(listingData.value);
        setListingError(null);
      } else if (listingData.status === "rejected") {
        setListingError(getErrorMessage(listingData.reason));
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
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
        {!listing && listingId && listingError && (
          <p className="text-sm text-warning mt-1">
            Could not load listing details. You can still select a locker.
          </p>
        )}
      </div>

      {/* Error banner for locker loading failures */}
      {lockerError && lockers.length === 0 && (
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
              <p className="text-sm font-medium text-destructive">{lockerError}</p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => loadData(false)}>
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

      {!selectedLocker && lockers.length > 0 && (
        <div className="p-4 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a locker on the map</p>
        </div>
      )}
    </div>
  );
}
