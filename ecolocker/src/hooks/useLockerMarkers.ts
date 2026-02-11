import { useState, useEffect, useRef, useCallback } from "react";
import type { Locker } from "../types";

const GREEN_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path fill="#22c55e" stroke="#15803d" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
  <circle fill="#ffffff" cx="12.5" cy="12.5" r="5"/>
</svg>`;

const RED_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path fill="#ef4444" stroke="#b91c1c" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>
  <circle fill="#ffffff" cx="12.5" cy="12.5" r="5"/>
</svg>`;

function parseCoordinates(coordString: string): { lat: number; lng: number } {
  const [lat, lng] = coordString.split(",").map((s) => parseFloat(s.trim()));
  return { lat, lng };
}

function markerIcon(svg: string): google.maps.Icon {
  return {
    url: "data:image/svg+xml," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(25, 41),
    anchor: new google.maps.Point(12, 41),
  };
}

interface UseLockerMarkersOptions {
  map: google.maps.Map | null;
  infoWindow: google.maps.InfoWindow | null;
  lockers: Locker[];
  selectable: boolean;
  onInfoWindowRender: (container: HTMLDivElement, locker: Locker, onSelect: () => void) => void;
}

export function useLockerMarkers({
  map,
  infoWindow,
  lockers,
  selectable,
  onInfoWindowRender,
}: UseLockerMarkersOptions) {
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  // Keep a stable ref to onInfoWindowRender to avoid re-creating markers on every render
  const onInfoWindowRenderRef = useRef(onInfoWindowRender);
  onInfoWindowRenderRef.current = onInfoWindowRender;

  const selectLocker = useCallback(
    (locker: Locker) => {
      // Swap marker colors
      setSelectedLocker((prev) => {
        if (prev && selectable) {
          const prevMarker = markersRef.current.get(prev.id);
          prevMarker?.setIcon(markerIcon(RED_MARKER_SVG));
        }
        return locker;
      });

      if (selectable) {
        const newMarker = markersRef.current.get(locker.id);
        newMarker?.setIcon(markerIcon(GREEN_MARKER_SVG));
      }

      infoWindow?.close();
    },
    [selectable, infoWindow]
  );

  const clearSelection = useCallback(() => {
    setSelectedLocker((prev) => {
      if (prev && selectable) {
        const prevMarker = markersRef.current.get(prev.id);
        prevMarker?.setIcon(markerIcon(RED_MARKER_SVG));
      }
      return null;
    });
  }, [selectable]);

  // Create/update markers when map or lockers change
  useEffect(() => {
    if (!map || !infoWindow) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    lockers.forEach((locker) => {
      const coords = parseCoordinates(locker.coordinates);

      const icon = selectable ? markerIcon(RED_MARKER_SVG) : undefined;

      const marker = new google.maps.Marker({
        position: coords,
        map,
        title: locker.name,
        ...(icon ? { icon } : {}),
      });

      marker.addListener("click", () => {
        const container = document.createElement("div");
        onInfoWindowRenderRef.current(container, locker, () => selectLocker(locker));
        infoWindow.setContent(container);
        infoWindow.open(map, marker);
      });

      markersRef.current.set(locker.id, marker);
    });

    // Restore selected marker color if it's still in the list
    setSelectedLocker((prev) => {
      if (prev && selectable) {
        const m = markersRef.current.get(prev.id);
        if (m) {
          m.setIcon(markerIcon(GREEN_MARKER_SVG));
          return prev;
        }
        return null;
      }
      return prev;
    });
  }, [map, infoWindow, lockers, selectable, selectLocker]);

  return { selectedLocker, selectLocker, clearSelection };
}
