import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  installGoogleMapsMock,
  type MockMapInstance,
  type MockInfoWindowInstance,
  type MockMarkerInstance,
} from "./google-maps-mock";
import type { Locker } from "../../types";
import { useLockerMarkers } from "../useLockerMarkers";

let googleMock: ReturnType<typeof installGoogleMapsMock>;

const locker1: Locker = {
  id: 1,
  name: "Tampines Hub Locker",
  address: "1 Tampines Walk, Singapore 528523",
  coordinates: "1.3523,103.9447",
  totalCompartments: 20,
  availableCompartments: 15,
  status: "active",
};

const locker2: Locker = {
  id: 2,
  name: "Jurong East MRT Locker",
  address: "10 Jurong East Street, Singapore 609594",
  coordinates: "1.3329,103.7436",
  totalCompartments: 30,
  availableCompartments: 22,
  status: "active",
};

let mockMap: MockMapInstance;
let mockInfoWindow: MockInfoWindowInstance;

beforeEach(() => {
  googleMock = installGoogleMapsMock();
  mockMap = new (window as any).google.maps.Map(null, {});
  mockInfoWindow = new (window as any).google.maps.InfoWindow();
  // Clear the instances that were just created for setup
  googleMock.instances.maps = [];
  googleMock.instances.infoWindows = [];
  googleMock.instances.markers = [];
});

afterEach(() => {
  googleMock.cleanup();
});

function renderLockerMarkers(overrides: Partial<Parameters<typeof useLockerMarkers>[0]> = {}) {
  const defaultProps = {
    map: mockMap as unknown as google.maps.Map,
    infoWindow: mockInfoWindow as unknown as google.maps.InfoWindow,
    lockers: [locker1, locker2],
    selectable: true,
    onInfoWindowRender: vi.fn(),
    ...overrides,
  };
  return renderHook(
    (props) => useLockerMarkers(props),
    { initialProps: defaultProps }
  );
}

describe("useLockerMarkers", () => {
  test("returns correct initial state", () => {
    const { result } = renderLockerMarkers();

    expect(result.current.selectedLocker).toBeNull();
    expect(typeof result.current.selectLocker).toBe("function");
    expect(typeof result.current.clearSelection).toBe("function");
  });

  test("does not create markers when map is null", () => {
    renderLockerMarkers({ map: null });

    expect(googleMock.instances.markers).toHaveLength(0);
  });

  test("creates a marker per locker with parsed coordinates", () => {
    renderLockerMarkers();

    expect(googleMock.instances.markers).toHaveLength(2);

    // Check first marker has correct parsed coordinates
    const marker1Opts = googleMock.instances.markers[0].opts;
    expect(marker1Opts.position).toEqual({ lat: 1.3523, lng: 103.9447 });
    expect(marker1Opts.title).toBe("Tampines Hub Locker");

    // Check second marker
    const marker2Opts = googleMock.instances.markers[1].opts;
    expect(marker2Opts.position).toEqual({ lat: 1.3329, lng: 103.7436 });
    expect(marker2Opts.title).toBe("Jurong East MRT Locker");

    // When selectable=true, markers should have red icon
    expect(marker1Opts.icon).toBeDefined();
  });

  test("clears old markers on locker list change", () => {
    const { rerender } = renderLockerMarkers();

    expect(googleMock.instances.markers).toHaveLength(2);

    const oldMarker1 = googleMock.instances.markers[0];
    const oldMarker2 = googleMock.instances.markers[1];

    // Rerender with new lockers
    const newLocker: Locker = {
      id: 3,
      name: "Bishan Locker",
      address: "Bishan",
      coordinates: "1.3508,103.8488",
      totalCompartments: 10,
      availableCompartments: 5,
      status: "active",
    };

    rerender({
      map: mockMap as unknown as google.maps.Map,
      infoWindow: mockInfoWindow as unknown as google.maps.InfoWindow,
      lockers: [newLocker],
      selectable: true,
      onInfoWindowRender: vi.fn(),
    });

    // Old markers should be removed from map
    expect(oldMarker1.setMap).toHaveBeenCalledWith(null);
    expect(oldMarker2.setMap).toHaveBeenCalledWith(null);

    // New marker should be created (total 3 in instances, but 2 old + 1 new)
    expect(googleMock.instances.markers).toHaveLength(3);
    const newMarkerOpts = googleMock.instances.markers[2].opts;
    expect(newMarkerOpts.title).toBe("Bishan Locker");
  });

  test("selectLocker sets green icon and closes infoWindow", () => {
    const { result } = renderLockerMarkers();

    const marker1 = googleMock.instances.markers[0];

    act(() => {
      result.current.selectLocker(locker1);
    });

    expect(result.current.selectedLocker).toEqual(locker1);

    // Marker1 should get green icon
    expect(marker1.setIcon).toHaveBeenCalled();
    const iconArg = marker1.setIcon.mock.calls[marker1.setIcon.mock.calls.length - 1][0];
    expect(iconArg.url).toContain(encodeURIComponent("#22c55e")); // green color

    // InfoWindow should be closed
    expect(mockInfoWindow.close).toHaveBeenCalled();
  });

  test("reselecting reverts previous marker to red", () => {
    const { result } = renderLockerMarkers();

    const marker1 = googleMock.instances.markers[0];
    const marker2 = googleMock.instances.markers[1];

    // Select locker1
    act(() => {
      result.current.selectLocker(locker1);
    });

    // Select locker2 — locker1 should revert to red
    act(() => {
      result.current.selectLocker(locker2);
    });

    expect(result.current.selectedLocker).toEqual(locker2);

    // marker1 should have been set back to red
    const marker1LastIcon = marker1.setIcon.mock.calls[marker1.setIcon.mock.calls.length - 1][0];
    expect(marker1LastIcon.url).toContain(encodeURIComponent("#ef4444")); // red color

    // marker2 should be green
    const marker2LastIcon = marker2.setIcon.mock.calls[marker2.setIcon.mock.calls.length - 1][0];
    expect(marker2LastIcon.url).toContain(encodeURIComponent("#22c55e")); // green color
  });

  test("clearSelection resets to red", () => {
    const { result } = renderLockerMarkers();

    const marker1 = googleMock.instances.markers[0];

    act(() => {
      result.current.selectLocker(locker1);
    });
    expect(result.current.selectedLocker).toEqual(locker1);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedLocker).toBeNull();

    // marker1 should revert to red
    const lastIcon = marker1.setIcon.mock.calls[marker1.setIcon.mock.calls.length - 1][0];
    expect(lastIcon.url).toContain(encodeURIComponent("#ef4444")); // red color
  });

  test("marker click opens info window with rendered content", () => {
    const onInfoWindowRender = vi.fn();

    renderLockerMarkers({ onInfoWindowRender });

    const marker1 = googleMock.instances.markers[0];

    // Extract the click listener that was registered
    const clickCb = (marker1 as any)._listeners.get("click");
    expect(clickCb).toBeDefined();

    // Invoke the click callback
    act(() => {
      clickCb();
    });

    // onInfoWindowRender should have been called with (container, locker, onSelect)
    expect(onInfoWindowRender).toHaveBeenCalledTimes(1);
    const [container, locker, onSelect] = onInfoWindowRender.mock.calls[0];
    expect(container).toBeInstanceOf(HTMLDivElement);
    expect(locker).toEqual(locker1);
    expect(typeof onSelect).toBe("function");

    // infoWindow should have been opened
    expect(mockInfoWindow.setContent).toHaveBeenCalledWith(container);
    expect(mockInfoWindow.open).toHaveBeenCalled();
  });
});
