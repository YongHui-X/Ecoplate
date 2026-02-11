/**
 * Coordinate parsing and validation utilities
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ParsedLocation {
  address: string;
  coordinates: Coordinates | null;
}

/**
 * Parse a pickup location string that may contain coordinates
 * Format: "Address|lat,lng" or just "Address"
 * @param pickupLocation - The raw pickup location string
 * @returns Parsed location with address and optional coordinates
 */
export function parsePickupLocation(
  pickupLocation: string | null | undefined
): ParsedLocation {
  if (!pickupLocation) {
    return { address: "", coordinates: null };
  }

  const parts = pickupLocation.split("|");
  const address = parts[0] || "";

  if (parts.length < 2) {
    return { address, coordinates: null };
  }

  const coordParts = parts[1].split(",");
  if (coordParts.length < 2) {
    return { address, coordinates: null };
  }

  const lat = parseFloat(coordParts[0]);
  const lng = parseFloat(coordParts[1]);

  if (isNaN(lat) || isNaN(lng)) {
    return { address, coordinates: null };
  }

  // Validate coordinate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { address, coordinates: null };
  }

  return { address, coordinates: { lat, lng } };
}

/**
 * Get display address from pickup location string
 * @param pickupLocation - The raw pickup location string
 * @returns The address portion only
 */
export function getDisplayAddress(
  pickupLocation: string | null | undefined
): string {
  return parsePickupLocation(pickupLocation).address;
}

/**
 * Check if a pickup location has valid coordinates
 * @param pickupLocation - The raw pickup location string
 * @returns True if coordinates are present and valid
 */
export function hasValidCoordinates(
  pickupLocation: string | null | undefined
): boolean {
  return parsePickupLocation(pickupLocation).coordinates !== null;
}

/**
 * Calculate distance between two coordinate pairs (Haversine formula)
 * @param coord1 - First coordinate pair
 * @param coord2 - Second coordinate pair
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
