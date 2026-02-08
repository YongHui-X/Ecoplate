import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  Navigation,
  Clock,
  Box,
  Loader2,
  ArrowLeft,
  RefreshCw,
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

// Fix Leaflet default icon issue
import "leaflet/dist/leaflet.css";
delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom green marker for selected locker
const selectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to recenter map
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 13);
  }, [map, lat, lng]);
  return null;
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

  // Singapore center coordinates
  const defaultCenter = { lat: 1.3521, lng: 103.8198 };

  useEffect(() => {
    // Get user's location using Capacitor hybrid geolocation
    getCurrentPosition().then((location) => {
      setUserLocation(location);
    });

    loadData();
  }, [listingId]);

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

  const mapCenter = userLocation || defaultCenter;

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
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap lat={mapCenter.lat} lng={mapCenter.lng} />

          {lockers.map((locker) => {
            const coords = parseCoordinates(locker.coordinates);
            const isSelected = selectedLocker?.id === locker.id;

            return (
              <Marker
                key={locker.id}
                position={[coords.lat, coords.lng]}
                icon={isSelected ? selectedIcon : new L.Icon.Default()}
                eventHandlers={{
                  click: () => setSelectedLocker(locker),
                }}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <h3 className="font-semibold">{locker.name}</h3>
                    <p className="text-sm text-gray-600">{locker.address}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Box className="h-4 w-4" />
                      {locker.availableCompartments}/{locker.totalCompartments} available
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
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
