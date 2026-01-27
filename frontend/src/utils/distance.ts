/**
 * Distance calculation utilities using Haversine formula
 * for calculating distances between geographical coordinates
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ListingWithDistance {
  id: number;
  title: string;
  pickupLocation: string;
  coordinates?: Coordinates;
  distance?: number; // in kilometers
  [key: string]: any;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate (user location)
 * @param coord2 Second coordinate (listing location)
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const EARTH_RADIUS_KM = 6371;

  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);

  // Haversine formula
  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return parseFloat(distance.toFixed(2));
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Filter listings by radius from user location
 * @param listings Array of listings
 * @param userLocation User's current coordinates
 * @param radiusKm Radius in kilometers
 * @returns Filtered listings with distance added
 */
export function filterListingsByRadius(
  listings: ListingWithDistance[],
  userLocation: Coordinates,
  radiusKm: number
): ListingWithDistance[] {
  return listings
    .map((listing) => {
      // Skip if listing doesn't have coordinates
      if (!listing.coordinates) {
        return { ...listing, distance: undefined };
      }

      const distance = calculateDistance(userLocation, listing.coordinates);
      return {
        ...listing,
        distance,
      };
    })
    .filter((listing) => {
      // Keep listings without coordinates or within radius
      return listing.distance === undefined || listing.distance <= radiusKm;
    })
    .sort((a, b) => {
      // Sort by distance (closest first), undefined distances go last
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });
}

/**
 * Parse coordinates from Google Maps URL or address string
 * Format: "lat,lng" or attempts to extract from Google Maps URL
 */
export function parseCoordinates(locationString: string): Coordinates | null {
  // Try to parse "lat,lng" format
  const coordMatch = locationString.match(
    /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/
  );
  if (coordMatch) {
    return {
      latitude: parseFloat(coordMatch[1]),
      longitude: parseFloat(coordMatch[2]),
    };
  }

  // Try to extract from Google Maps URL
  const urlMatch = locationString.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (urlMatch) {
    return {
      latitude: parseFloat(urlMatch[1]),
      longitude: parseFloat(urlMatch[2]),
    };
  }

  return null;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number | undefined): string {
  if (distanceKm === undefined) {
    return 'Distance unknown';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m away`;
  }

  return `${distanceKm.toFixed(1)}km away`;
}

/**
 * Check if coordinates are valid Singapore coordinates
 * Singapore bounds: lat 1.15-1.48, lng 103.6-104.1
 */
export function isValidSingaporeCoordinates(coord: Coordinates): boolean {
  const { latitude, longitude } = coord;
  return (
    latitude >= 1.15 &&
    latitude <= 1.48 &&
    longitude >= 103.6 &&
    longitude <= 104.1
  );
}

/**
 * Default Singapore center coordinates (roughly city center)
 */
export const SINGAPORE_CENTER: Coordinates = {
  latitude: 1.3521,
  longitude: 103.8198,
};

/**
 * NUS coordinates (for testing)
 */
export const NUS_COORDINATES: Coordinates = {
  latitude: 1.2966,
  longitude: 103.7764,
};
