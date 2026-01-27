/**
 * Distance calculation utilities using Haversine formula
 * for backend marketplace APIs
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
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
 * Parse coordinates from location string
 * Supports formats: "lat,lng" or "address|lat,lng"
 */
export function parseCoordinates(
  locationString: string | null
): Coordinates | null {
  if (!locationString) return null;

  // Check for "address|lat,lng" format
  if (locationString.includes("|")) {
    const parts = locationString.split("|");
    if (parts.length === 2) {
      locationString = parts[1];
    }
  }

  // Parse "lat,lng" format
  const coordMatch = locationString.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return {
      latitude: parseFloat(coordMatch[1]),
      longitude: parseFloat(coordMatch[2]),
    };
  }

  return null;
}

/**
 * Check if coordinates are within Singapore bounds
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
 * Format coordinates as "lat,lng" string
 */
export function formatCoordinates(coord: Coordinates): string {
  return `${coord.latitude},${coord.longitude}`;
}
