import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  filterListingsByRadius,
  parseCoordinates,
  formatDistance,
  isValidSingaporeCoordinates,
  SINGAPORE_CENTER,
  NUS_COORDINATES,
  type Coordinates,
  type ListingWithDistance,
} from './distance';

describe('Distance Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      const coord1: Coordinates = { latitude: 1.3521, longitude: 103.8198 }; // Singapore center
      const coord2: Coordinates = { latitude: 1.2966, longitude: 103.7764 }; // NUS

      const distance = calculateDistance(coord1, coord2);

      // Distance between Singapore center and NUS is approximately 7-8 km
      expect(distance).toBeGreaterThan(6);
      expect(distance).toBeLessThan(9);
    });

    it('should return 0 for same coordinates', () => {
      const coord: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
      const distance = calculateDistance(coord, coord);

      expect(distance).toBe(0);
    });

    it('should calculate correct distance for known locations', () => {
      // Distance from Singapore center to NUS
      const distance = calculateDistance(SINGAPORE_CENTER, NUS_COORDINATES);

      expect(distance).toBeCloseTo(7.5, 1); // Approximately 7.5 km
    });

    it('should handle negative coordinates', () => {
      const coord1: Coordinates = { latitude: -1.0, longitude: -1.0 };
      const coord2: Coordinates = { latitude: 1.0, longitude: 1.0 };

      const distance = calculateDistance(coord1, coord2);

      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('filterListingsByRadius', () => {
    const userLocation: Coordinates = SINGAPORE_CENTER;

    const listings: ListingWithDistance[] = [
      {
        id: 1,
        title: 'Listing 1',
        pickupLocation: 'NUS',
        coordinates: NUS_COORDINATES, // ~7.5km from center
      },
      {
        id: 2,
        title: 'Listing 2',
        pickupLocation: 'Near center',
        coordinates: { latitude: 1.3500, longitude: 103.8200 }, // Very close
      },
      {
        id: 3,
        title: 'Listing 3',
        pickupLocation: 'Far location',
        coordinates: { latitude: 1.4500, longitude: 104.0000 }, // Far away
      },
      {
        id: 4,
        title: 'Listing 4',
        pickupLocation: 'No coordinates',
        // No coordinates
      },
    ];

    it('should filter listings within radius', () => {
      const filtered = filterListingsByRadius(listings, userLocation, 5);

      // Only listing 2 should be within 5km
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((l) => l.distance === undefined || l.distance <= 5)).toBe(true);
    });

    it('should include all listings with large radius', () => {
      const filtered = filterListingsByRadius(listings, userLocation, 100);

      expect(filtered.length).toBeGreaterThanOrEqual(3); // All with coordinates
    });

    it('should add distance to listings', () => {
      const filtered = filterListingsByRadius(listings, userLocation, 50);

      const withDistance = filtered.filter((l) => l.distance !== undefined);
      expect(withDistance.length).toBeGreaterThan(0);
      withDistance.forEach((listing) => {
        expect(typeof listing.distance).toBe('number');
      });
    });

    it('should sort by distance (closest first)', () => {
      const filtered = filterListingsByRadius(listings, userLocation, 50);

      const withDistance = filtered.filter((l) => l.distance !== undefined);

      for (let i = 1; i < withDistance.length; i++) {
        expect(withDistance[i].distance!).toBeGreaterThanOrEqual(
          withDistance[i - 1].distance!
        );
      }
    });

    it('should handle empty listings array', () => {
      const filtered = filterListingsByRadius([], userLocation, 10);

      expect(filtered).toEqual([]);
    });
  });

  describe('parseCoordinates', () => {
    it('should parse lat,lng format', () => {
      const result = parseCoordinates('1.3521,103.8198');

      expect(result).toEqual({ latitude: 1.3521, longitude: 103.8198 });
    });

    it('should parse lat,lng with spaces', () => {
      const result = parseCoordinates('1.3521, 103.8198');

      expect(result).toEqual({ latitude: 1.3521, longitude: 103.8198 });
    });

    it('should parse Google Maps URL', () => {
      const url =
        'https://www.google.com/maps/@1.3521,103.8198,15z';
      const result = parseCoordinates(url);

      expect(result).toEqual({ latitude: 1.3521, longitude: 103.8198 });
    });

    it('should handle negative coordinates', () => {
      const result = parseCoordinates('-1.5,-103.8');

      expect(result).toEqual({ latitude: -1.5, longitude: -103.8 });
    });

    it('should return null for invalid format', () => {
      const result = parseCoordinates('invalid string');

      expect(result).toBeNull();
    });

    it('should return null for address without coordinates', () => {
      const result = parseCoordinates('123 Main Street, Singapore');

      expect(result).toBeNull();
    });
  });

  describe('formatDistance', () => {
    it('should format distance < 1km as meters', () => {
      expect(formatDistance(0.5)).toBe('500m away');
      expect(formatDistance(0.123)).toBe('123m away');
    });

    it('should format distance >= 1km as kilometers', () => {
      expect(formatDistance(1.5)).toBe('1.5km away');
      expect(formatDistance(10)).toBe('10.0km away');
      expect(formatDistance(2.345)).toBe('2.3km away');
    });

    it('should handle undefined distance', () => {
      expect(formatDistance(undefined)).toBe('Distance unknown');
    });

    it('should handle 0 distance', () => {
      expect(formatDistance(0)).toBe('0m away');
    });
  });

  describe('isValidSingaporeCoordinates', () => {
    it('should validate Singapore center coordinates', () => {
      expect(isValidSingaporeCoordinates(SINGAPORE_CENTER)).toBe(true);
    });

    it('should validate NUS coordinates', () => {
      expect(isValidSingaporeCoordinates(NUS_COORDINATES)).toBe(true);
    });

    it('should reject coordinates outside Singapore (too north)', () => {
      const coord: Coordinates = { latitude: 2.0, longitude: 103.8 };
      expect(isValidSingaporeCoordinates(coord)).toBe(false);
    });

    it('should reject coordinates outside Singapore (too south)', () => {
      const coord: Coordinates = { latitude: 1.0, longitude: 103.8 };
      expect(isValidSingaporeCoordinates(coord)).toBe(false);
    });

    it('should reject coordinates outside Singapore (too east)', () => {
      const coord: Coordinates = { latitude: 1.35, longitude: 105.0 };
      expect(isValidSingaporeCoordinates(coord)).toBe(false);
    });

    it('should reject coordinates outside Singapore (too west)', () => {
      const coord: Coordinates = { latitude: 1.35, longitude: 103.0 };
      expect(isValidSingaporeCoordinates(coord)).toBe(false);
    });

    it('should validate coordinates at Singapore boundaries', () => {
      const southWest: Coordinates = { latitude: 1.15, longitude: 103.6 };
      const northEast: Coordinates = { latitude: 1.48, longitude: 104.1 };

      expect(isValidSingaporeCoordinates(southWest)).toBe(true);
      expect(isValidSingaporeCoordinates(northEast)).toBe(true);
    });
  });
});
