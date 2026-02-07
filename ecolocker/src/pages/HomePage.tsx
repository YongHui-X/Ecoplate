import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  Clock,
  Box,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { lockerApi } from "../services/locker-api";
import { getCurrentPosition } from "../services/capacitor";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getErrorMessage } from "../utils/network";
import type { Locker } from "../types";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

// Fix Leaflet default icon issue
import "leaflet/dist/leaflet.css";
delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Component to recenter map
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 12);
  }, [map, lat, lng]);
  return null;
}

export function HomePage() {
  const navigate = useNavigate();
  const { listingId } = useAuth();
  const { addToast } = useToast();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  const mapCenter = userLocation || defaultCenter;

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
      <div className="flex-1">
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

            return (
              <Marker
                key={locker.id}
                position={[coords.lat, coords.lng]}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <h3 className="font-semibold">{locker.name}</h3>
                    <p className="text-sm text-gray-600">{locker.address}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Box className="h-4 w-4" />
                      {locker.availableCompartments}/{locker.totalCompartments} available
                    </div>
                    {locker.operatingHours && (
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <Clock className="h-4 w-4" />
                        {locker.operatingHours}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
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
