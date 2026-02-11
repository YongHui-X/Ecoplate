import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createGoogleMapsMock, type MockInstances } from "./google-maps-mock";

// Because useGoogleMap uses a module-level singleton `scriptPromise`,
// we must reset modules before each test and dynamically import.
let useGoogleMap: typeof import("../useGoogleMap").useGoogleMap;
let googleMock: ReturnType<typeof createGoogleMapsMock>;
let mockInstances: MockInstances;

beforeEach(async () => {
  vi.resetModules();

  // Prepare a mock but DON'T install on window yet — the hook's
  // loadGoogleMapsScript checks window.google?.maps to short-circuit.
  // We install it only when simulating "the script finished loading".
  googleMock = createGoogleMapsMock();
  mockInstances = googleMock.instances;

  // Remove any leftover google from previous test
  delete (window as any).google;

  // Dynamic import to get fresh module (new scriptPromise = null)
  const mod = await import("../useGoogleMap");
  useGoogleMap = mod.useGoogleMap;
});

afterEach(() => {
  delete (window as any).google;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Helper: intercept document.head.appendChild and capture the google maps script */
function interceptScript() {
  let capturedScript: HTMLScriptElement | null = null;
  const originalAppendChild = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
    if (node instanceof HTMLScriptElement && node.id === "google-maps-script") {
      capturedScript = node;
      return node;
    }
    return originalAppendChild(node);
  });
  return {
    get script() { return capturedScript; },
    async waitForScript() {
      await vi.waitFor(() => {
        expect(capturedScript).not.toBeNull();
      });
      return capturedScript!;
    },
  };
}

/** Simulate successful script load: install google maps mock on window, then fire onload */
async function simulateScriptLoad(script: HTMLScriptElement) {
  (window as any).google = googleMock.google;
  await act(async () => {
    script.onload?.(new Event("load"));
  });
}

describe("useGoogleMap", () => {
  test("returns correct initial state", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");

    const { result } = renderHook(() => useGoogleMap());

    expect(result.current.map).toBeNull();
    expect(result.current.infoWindow).toBeNull();
    expect(result.current.isLoaded).toBe(false);
    expect(typeof result.current.mapRef).toBe("function");
  });

  test("sets error when API key is missing", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");

    const { result } = renderHook(() => useGoogleMap());

    await vi.waitFor(() => {
      expect(result.current.error).toBe("Google Maps API key not configured");
    });
    expect(result.current.isLoaded).toBe(false);
  });

  test("loads script and sets isLoaded=true on success", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-api-key");
    const interceptor = interceptScript();

    const { result } = renderHook(() => useGoogleMap());

    const script = await interceptor.waitForScript();

    await simulateScriptLoad(script);

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.error).toBeNull();
  });

  test("sets error on script load failure", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-api-key");
    const interceptor = interceptScript();

    const { result } = renderHook(() => useGoogleMap());

    const script = await interceptor.waitForScript();

    // Simulate script failure
    await act(async () => {
      script.onerror?.(new Event("error"));
    });

    expect(result.current.error).toBe("Failed to load Google Maps");
    expect(result.current.isLoaded).toBe(false);
  });

  test("creates Map and InfoWindow when isLoaded and mapRef is called", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-api-key");
    const interceptor = interceptScript();

    const { result } = renderHook(() => useGoogleMap());

    const script = await interceptor.waitForScript();
    await simulateScriptLoad(script);

    // Provide DOM element via mapRef
    const mockDiv = document.createElement("div");
    await act(async () => {
      result.current.mapRef(mockDiv);
    });

    expect(result.current.map).not.toBeNull();
    expect(result.current.infoWindow).not.toBeNull();
    expect(mockInstances.maps).toHaveLength(1);
    expect(mockInstances.infoWindows).toHaveLength(1);

    // Verify Map was called with correct config
    expect(googleMock.google.maps.Map).toHaveBeenCalledWith(
      mockDiv,
      expect.objectContaining({
        center: { lat: 1.3521, lng: 103.8198 },
        zoom: 12,
      })
    );
  });

  test("does not create map when mapRef not called", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-api-key");
    const interceptor = interceptScript();

    const { result } = renderHook(() => useGoogleMap());

    const script = await interceptor.waitForScript();
    await simulateScriptLoad(script);

    // isLoaded is true but no DOM element provided
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.map).toBeNull();
    expect(mockInstances.maps).toHaveLength(0);
  });

  test("cleans up on unmount", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-api-key");
    const interceptor = interceptScript();

    const { result, unmount } = renderHook(() => useGoogleMap());

    const script = await interceptor.waitForScript();
    await simulateScriptLoad(script);

    const mockDiv = document.createElement("div");
    await act(async () => {
      result.current.mapRef(mockDiv);
    });

    expect(mockInstances.maps).toHaveLength(1);
    expect(mockInstances.infoWindows).toHaveLength(1);

    const mapInstance = mockInstances.maps[0];
    const infoWindowInstance = mockInstances.infoWindows[0];

    // Unmount should trigger cleanup
    unmount();

    expect(googleMock.google.maps.event.clearInstanceListeners).toHaveBeenCalledWith(mapInstance);
    expect(infoWindowInstance.close).toHaveBeenCalled();
  });
});
