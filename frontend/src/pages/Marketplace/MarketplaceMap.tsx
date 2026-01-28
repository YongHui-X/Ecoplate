import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
// @ts-ignore - react-leaflet-cluster doesn't have proper types
import MarkerClusterGroup from "react-leaflet-cluster";
import { Icon, LatLngExpression } from "leaflet";
import { useGeolocation } from "../../hooks/useGeolocation";
import { filterListingsByRadius, type Coordinates } from "../../utils/distance";
import { ListingMapCard } from "../../components/marketplace/ListingMapCard";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { List, Map as MapIcon, Loader2, MapPin, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { MarketplaceListingWithDistance } from "../../types/marketplace";

// Fix Leaflet default marker icon issue
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = new Icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const UserLocationIcon = new Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="3"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface MarketplaceMapProps {
  listings?: MarketplaceListingWithDistance[];
  loading?: boolean;
  onToggleView?: () => void;
}

/**
 * Component to recenter map when user location changes
 */
function RecenterMap({ center }: { center: LatLngExpression }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

// Default location for postal code 169648 (Queenstown, Singapore)
const DEFAULT_USER_LOCATION: Coordinates = {
  latitude: 1.2905,
  longitude: 103.8006,
};

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

  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [useDefaultLocation, setUseDefaultLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([
    DEFAULT_USER_LOCATION.latitude,
    DEFAULT_USER_LOCATION.longitude,
  ]);

  // Actual user location to use (either from GPS or default)
  const effectiveUserLocation = useDefaultLocation
    ? DEFAULT_USER_LOCATION
    : userLocation;

  // Filter listings by radius
  const filteredListings = useMemo(() => {
    if (!effectiveUserLocation) return listings;

    return filterListingsByRadius(
      listings.filter((l) => l.coordinates),
      effectiveUserLocation,
      radiusKm
    );
  }, [listings, effectiveUserLocation, radiusKm]);

  // Update map center when user location is available
  useEffect(() => {
    if (effectiveUserLocation) {
      setMapCenter([
        effectiveUserLocation.latitude,
        effectiveUserLocation.longitude,
      ]);
    }
  }, [effectiveUserLocation]);

  // Request location on mount
  useEffect(() => {
    const initLocation = async () => {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        await getCurrentPosition();
      } else {
        // If permission denied, use default location
        setUseDefaultLocation(true);
      }
    };

    initLocation();
  }, [requestPermission, getCurrentPosition]);

  const handleGetLocation = async () => {
    clearError();
    setUseDefaultLocation(false);
    const hasPermission = await requestPermission();
    if (hasPermission) {
      await getCurrentPosition();
    } else {
      setUseDefaultLocation(true);
    }
  };

  const handleUseDefaultLocation = () => {
    clearError();
    setUseDefaultLocation(true);
  };

  const handleViewDetails = (listingId: number) => {
    navigate(`/marketplace/${listingId}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <Card className="p-4 mb-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="radius" className="text-sm">
                Radius: {radiusKm} km
              </Label>
              <Input
                id="radius"
                type="range"
                min="1"
                max="20"
                step="1"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <Button
              onClick={handleGetLocation}
              variant="outline"
              size="sm"
              disabled={geoLoading}
            >
              {geoLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Getting location...
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  My Location
                </>
              )}
            </Button>
          </div>

          {onToggleView && (
            <Button onClick={onToggleView} variant="outline" size="sm">
              <List className="h-4 w-4 mr-2" />
              List View
            </Button>
          )}
        </div>

        {/* Location Error */}
        {geoError && !useDefaultLocation && (
          <div className="flex items-center justify-between gap-2 text-sm text-orange-600 bg-orange-50 p-3 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{geoError}</span>
            </div>
            <Button
              onClick={handleUseDefaultLocation}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Use Default Location (169648)
            </Button>
          </div>
        )}

        {/* Using Default Location Info */}
        {useDefaultLocation && (
          <div className="flex items-center justify-between gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>Using default location: Queenstown, Singapore 169648</span>
            </div>
            <Button
              onClick={handleGetLocation}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Use My Location
            </Button>
          </div>
        )}

        {/* Listings Count */}
        <div className="text-sm text-gray-600">
          Showing {filteredListings.length} listing
          {filteredListings.length !== 1 ? "s" : ""}{" "}
          {effectiveUserLocation && `within ${radiusKm}km`}
        </div>
      </Card>

      {/* Map */}
      <div className="flex-1 relative rounded-lg overflow-hidden border">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom={true}
            className="h-full w-full"
            style={{ height: "100%", minHeight: "500px" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <RecenterMap center={mapCenter} />

            {/* User Location Marker */}
            {effectiveUserLocation && (
              <>
                <Marker
                  position={[
                    effectiveUserLocation.latitude,
                    effectiveUserLocation.longitude,
                  ]}
                  icon={UserLocationIcon}
                >
                  <Popup>
                    <div className="text-center">
                      <p className="font-semibold">
                        {useDefaultLocation
                          ? "Default Location (169648)"
                          : "Your Location"}
                      </p>
                      {useDefaultLocation && (
                        <p className="text-xs text-gray-500 mt-1">
                          Queenstown, Singapore
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>

                {/* Radius Circle */}
                <Circle
                  center={[
                    effectiveUserLocation.latitude,
                    effectiveUserLocation.longitude,
                  ]}
                  radius={radiusKm * 1000} // Convert km to meters
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.1,
                    weight: 2,
                  }}
                />
              </>
            )}

            {/* Listing Markers with Clustering */}
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={50}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
            >
              {filteredListings.map((listing) => {
                if (!listing.coordinates) return null;

                return (
                  <Marker
                    key={listing.id}
                    position={[
                      listing.coordinates.latitude,
                      listing.coordinates.longitude,
                    ]}
                    icon={DefaultIcon}
                  >
                    <Popup>
                      <ListingMapCard
                        listing={listing}
                        onViewDetails={() => handleViewDetails(listing.id)}
                      />
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        )}
      </div>

      {/* No listings message */}
      {!loading && filteredListings.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Card className="p-6 text-center pointer-events-auto">
            <MapIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No listings found in this area</p>
            <p className="text-sm text-gray-500 mt-1">
              Try increasing the radius
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
