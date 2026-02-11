/**
 * Reusable Google Maps global mock for testing hooks that depend on window.google.maps.*
 * Returns { google, instances } where instances tracks every created Map/Marker/InfoWindow.
 */

export interface MockMarkerInstance {
  opts: Record<string, unknown>;
  setIcon: ReturnType<typeof vi.fn>;
  setMap: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  getPosition: ReturnType<typeof vi.fn>;
}

export interface MockMapInstance {
  opts: Record<string, unknown>;
  panTo: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
}

export interface MockInfoWindowInstance {
  setContent: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

export interface MockInstances {
  maps: MockMapInstance[];
  markers: MockMarkerInstance[];
  infoWindows: MockInfoWindowInstance[];
}

export function createGoogleMapsMock() {
  const instances: MockInstances = {
    maps: [],
    markers: [],
    infoWindows: [],
  };

  const MockMap = vi.fn().mockImplementation((element: unknown, opts: Record<string, unknown>) => {
    const instance: MockMapInstance = {
      opts: { element, ...opts },
      panTo: vi.fn(),
      setCenter: vi.fn(),
      setZoom: vi.fn(),
    };
    instances.maps.push(instance);
    return instance;
  });

  const MockInfoWindow = vi.fn().mockImplementation(() => {
    const instance: MockInfoWindowInstance = {
      setContent: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
    };
    instances.infoWindows.push(instance);
    return instance;
  });

  const MockMarker = vi.fn().mockImplementation((opts: Record<string, unknown>) => {
    const listeners = new Map<string, Function>();
    const instance: MockMarkerInstance = {
      opts: { ...opts },
      setIcon: vi.fn(),
      setMap: vi.fn(),
      setPosition: vi.fn(),
      addListener: vi.fn((event: string, cb: Function) => {
        listeners.set(event, cb);
        return { remove: vi.fn() };
      }),
      getPosition: vi.fn(() => opts.position),
    };
    // Expose listeners for test assertions
    (instance as any)._listeners = listeners;
    instances.markers.push(instance);
    return instance;
  });

  const MockSize = vi.fn().mockImplementation((w: number, h: number) => ({ width: w, height: h }));
  const MockPoint = vi.fn().mockImplementation((x: number, y: number) => ({ x, y }));

  const google = {
    maps: {
      Map: MockMap,
      InfoWindow: MockInfoWindow,
      Marker: MockMarker,
      Size: MockSize,
      Point: MockPoint,
      event: {
        clearInstanceListeners: vi.fn(),
      },
    },
  };

  return { google, instances };
}

/**
 * Install the mock onto window.google and return cleanup function
 */
export function installGoogleMapsMock() {
  const mock = createGoogleMapsMock();
  (window as any).google = mock.google;
  return {
    ...mock,
    cleanup: () => {
      delete (window as any).google;
    },
  };
}
