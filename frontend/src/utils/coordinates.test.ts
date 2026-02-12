import { describe, it, expect } from "vitest";
import {
  parsePickupLocation,
  getDisplayAddress,
  hasValidCoordinates,
  calculateDistance,
  Coordinates,
} from "./coordinates";

describe("coordinates utils", () => {
  describe("parsePickupLocation", () => {
    it("parses address with valid coordinates", () => {
      const result = parsePickupLocation("123 Main St|1.3521,103.8198");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toEqual({ lat: 1.3521, lng: 103.8198 });
    });

    it("parses address without coordinates", () => {
      const result = parsePickupLocation("123 Main St");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("returns empty for null input", () => {
      const result = parsePickupLocation(null);
      expect(result.address).toBe("");
      expect(result.coordinates).toBeNull();
    });

    it("returns empty for undefined input", () => {
      const result = parsePickupLocation(undefined);
      expect(result.address).toBe("");
      expect(result.coordinates).toBeNull();
    });

    it("returns empty for empty string", () => {
      const result = parsePickupLocation("");
      expect(result.address).toBe("");
      expect(result.coordinates).toBeNull();
    });

    it("handles address with pipe but invalid coordinates format", () => {
      const result = parsePickupLocation("123 Main St|invalid");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("handles address with pipe but only one coordinate part", () => {
      const result = parsePickupLocation("123 Main St|1.3521");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("handles non-numeric coordinate values", () => {
      const result = parsePickupLocation("123 Main St|abc,def");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("handles latitude out of range (> 90)", () => {
      const result = parsePickupLocation("123 Main St|91,103.8198");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("handles latitude out of range (< -90)", () => {
      const result = parsePickupLocation("123 Main St|-91,103.8198");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("handles longitude out of range (> 180)", () => {
      const result = parsePickupLocation("123 Main St|1.3521,181");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("handles longitude out of range (< -180)", () => {
      const result = parsePickupLocation("123 Main St|1.3521,-181");
      expect(result.address).toBe("123 Main St");
      expect(result.coordinates).toBeNull();
    });

    it("accepts boundary latitude values", () => {
      const result1 = parsePickupLocation("North Pole|90,0");
      expect(result1.coordinates).toEqual({ lat: 90, lng: 0 });

      const result2 = parsePickupLocation("South Pole|-90,0");
      expect(result2.coordinates).toEqual({ lat: -90, lng: 0 });
    });

    it("accepts boundary longitude values", () => {
      const result1 = parsePickupLocation("Date Line East|0,180");
      expect(result1.coordinates).toEqual({ lat: 0, lng: 180 });

      const result2 = parsePickupLocation("Date Line West|0,-180");
      expect(result2.coordinates).toEqual({ lat: 0, lng: -180 });
    });

    it("handles negative coordinates", () => {
      const result = parsePickupLocation("Sydney|-33.8688,151.2093");
      expect(result.address).toBe("Sydney");
      expect(result.coordinates).toEqual({ lat: -33.8688, lng: 151.2093 });
    });

    it("handles addresses with special characters", () => {
      const result = parsePickupLocation("Café & Bistro, #01-23|1.3521,103.8198");
      expect(result.address).toBe("Café & Bistro, #01-23");
      expect(result.coordinates).toEqual({ lat: 1.3521, lng: 103.8198 });
    });

    it("handles multiple pipe characters", () => {
      const result = parsePickupLocation("Address|1.35,103.82|extra");
      expect(result.address).toBe("Address");
      expect(result.coordinates).toEqual({ lat: 1.35, lng: 103.82 });
    });
  });

  describe("getDisplayAddress", () => {
    it("returns address from location with coordinates", () => {
      expect(getDisplayAddress("123 Main St|1.3521,103.8198")).toBe("123 Main St");
    });

    it("returns address from location without coordinates", () => {
      expect(getDisplayAddress("123 Main St")).toBe("123 Main St");
    });

    it("returns empty string for null", () => {
      expect(getDisplayAddress(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(getDisplayAddress(undefined)).toBe("");
    });

    it("returns empty string for empty input", () => {
      expect(getDisplayAddress("")).toBe("");
    });
  });

  describe("hasValidCoordinates", () => {
    it("returns true for location with valid coordinates", () => {
      expect(hasValidCoordinates("123 Main St|1.3521,103.8198")).toBe(true);
    });

    it("returns false for location without coordinates", () => {
      expect(hasValidCoordinates("123 Main St")).toBe(false);
    });

    it("returns false for null", () => {
      expect(hasValidCoordinates(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(hasValidCoordinates(undefined)).toBe(false);
    });

    it("returns false for invalid coordinates", () => {
      expect(hasValidCoordinates("123 Main St|abc,def")).toBe(false);
    });

    it("returns false for out-of-range coordinates", () => {
      expect(hasValidCoordinates("123 Main St|91,103.8198")).toBe(false);
    });
  });

  describe("calculateDistance", () => {
    it("calculates distance between two points", () => {
      // Singapore to Kuala Lumpur is approximately 315 km
      const singapore: Coordinates = { lat: 1.3521, lng: 103.8198 };
      const kualaLumpur: Coordinates = { lat: 3.139, lng: 101.6869 };
      const distance = calculateDistance(singapore, kualaLumpur);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(330);
    });

    it("returns 0 for same coordinates", () => {
      const point: Coordinates = { lat: 1.3521, lng: 103.8198 };
      const distance = calculateDistance(point, point);
      expect(distance).toBe(0);
    });

    it("calculates short distances accurately", () => {
      // Two points about 1 km apart in Singapore
      const point1: Coordinates = { lat: 1.3521, lng: 103.8198 };
      const point2: Coordinates = { lat: 1.3611, lng: 103.8198 }; // ~1km north
      const distance = calculateDistance(point1, point2);
      expect(distance).toBeGreaterThan(0.9);
      expect(distance).toBeLessThan(1.1);
    });

    it("calculates long distances accurately", () => {
      // Singapore to London is approximately 10,850 km
      const singapore: Coordinates = { lat: 1.3521, lng: 103.8198 };
      const london: Coordinates = { lat: 51.5074, lng: -0.1278 };
      const distance = calculateDistance(singapore, london);
      expect(distance).toBeGreaterThan(10800);
      expect(distance).toBeLessThan(10900);
    });

    it("handles negative latitudes", () => {
      // Sydney to Singapore
      const sydney: Coordinates = { lat: -33.8688, lng: 151.2093 };
      const singapore: Coordinates = { lat: 1.3521, lng: 103.8198 };
      const distance = calculateDistance(sydney, singapore);
      expect(distance).toBeGreaterThan(6000);
      expect(distance).toBeLessThan(6500);
    });

    it("handles negative longitudes", () => {
      // New York to London
      const newYork: Coordinates = { lat: 40.7128, lng: -74.006 };
      const london: Coordinates = { lat: 51.5074, lng: -0.1278 };
      const distance = calculateDistance(newYork, london);
      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });

    it("is symmetric (distance A to B equals B to A)", () => {
      const point1: Coordinates = { lat: 1.3521, lng: 103.8198 };
      const point2: Coordinates = { lat: 51.5074, lng: -0.1278 };
      const distance1 = calculateDistance(point1, point2);
      const distance2 = calculateDistance(point2, point1);
      expect(distance1).toBeCloseTo(distance2, 5);
    });

    it("handles poles", () => {
      const northPole: Coordinates = { lat: 90, lng: 0 };
      const southPole: Coordinates = { lat: -90, lng: 0 };
      const distance = calculateDistance(northPole, southPole);
      // Half of Earth's circumference is approximately 20,000 km
      expect(distance).toBeGreaterThan(19900);
      expect(distance).toBeLessThan(20100);
    });

    it("handles equator points", () => {
      const equator1: Coordinates = { lat: 0, lng: 0 };
      const equator2: Coordinates = { lat: 0, lng: 90 };
      const distance = calculateDistance(equator1, equator2);
      // Quarter of Earth's circumference at equator is approximately 10,000 km
      expect(distance).toBeGreaterThan(9900);
      expect(distance).toBeLessThan(10100);
    });
  });
});
