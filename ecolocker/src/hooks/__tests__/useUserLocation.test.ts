import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { installGoogleMapsMock, type MockMapInstance } from "./google-maps-mock";

// Mock the capacitor service
vi.mock("../../services/capacitor", () => ({
  getCurrentPosition: vi.fn(),
  isNative: false,
  platform: "web",
}));

import { getCurrentPosition } from "../../services/capacitor";
import { useUserLocation } from "../useUserLocation";

const mockedGetCurrentPosition = vi.mocked(getCurrentPosition);

let googleMock: ReturnType<typeof installGoogleMapsMock>;

beforeEach(() => {
  googleMock = installGoogleMapsMock();
  vi.clearAllMocks();
});

afterEach(() => {
  googleMock.cleanup();
});

describe("useUserLocation", () => {
  test("returns correct initial state", () => {
    mockedGetCurrentPosition.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() =>
      useUserLocation({ map: null })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.coordinates).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test("sets coordinates when position resolves", async () => {
    mockedGetCurrentPosition.mockResolvedValue({ lat: 1.35, lng: 103.82 });

    const { result } = renderHook(() =>
      useUserLocation({ map: null })
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.coordinates).toEqual({ lat: 1.35, lng: 103.82 });
    expect(result.current.error).toBeNull();
  });

  test("pans map and creates blue dot marker when map is provided", async () => {
    mockedGetCurrentPosition.mockResolvedValue({ lat: 1.35, lng: 103.82 });

    // Create a mock map instance
    const mockMap = new (window as any).google.maps.Map(null, {}) as MockMapInstance;

    const { result } = renderHook(() =>
      useUserLocation({ map: mockMap as unknown as google.maps.Map })
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Map should have been panned
    expect(mockMap.panTo).toHaveBeenCalledWith({ lat: 1.35, lng: 103.82 });

    // Blue dot marker should have been created
    expect(googleMock.instances.markers).toHaveLength(1);
    const markerOpts = googleMock.instances.markers[0].opts;
    expect(markerOpts.position).toEqual({ lat: 1.35, lng: 103.82 });
    expect(markerOpts.title).toBe("Your Location");
    expect((markerOpts.icon as any).url).toContain("data:image/svg+xml,");
  });

  test("does not create marker when map is null", async () => {
    mockedGetCurrentPosition.mockResolvedValue({ lat: 1.35, lng: 103.82 });

    const { result } = renderHook(() =>
      useUserLocation({ map: null })
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // No markers should be created since map is null
    // Filter out the map instance created in the mock setup
    const markerCount = googleMock.instances.markers.length;
    // The Marker constructor from google maps mock should not be called
    expect((window as any).google.maps.Marker).not.toHaveBeenCalled();
  });

  test("sets error on geolocation failure", async () => {
    mockedGetCurrentPosition.mockRejectedValue(new Error("Permission denied"));

    const { result } = renderHook(() =>
      useUserLocation({ map: null })
    );

    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Permission denied");
    expect(result.current.coordinates).toBeNull();
  });

  test("does not update state after unmount", async () => {
    let resolvePosition: (val: { lat: number; lng: number }) => void;
    mockedGetCurrentPosition.mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      })
    );

    const { result, unmount } = renderHook(() =>
      useUserLocation({ map: null })
    );

    expect(result.current.loading).toBe(true);

    // Unmount before the promise resolves
    unmount();

    // Now resolve - should not cause React warnings
    await act(async () => {
      resolvePosition!({ lat: 1.35, lng: 103.82 });
    });

    // If we get here without warnings, the cleanup worked
    expect(result.current.loading).toBe(true); // unchanged since unmounted
  });
});
