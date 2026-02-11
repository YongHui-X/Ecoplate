import { useState, useEffect, useRef } from "react";
import { getCurrentPosition } from "../services/capacitor";

const BLUE_DOT_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/><circle cx="12" cy="12" r="4" fill="#ffffff"/></svg>'
  );

interface UseUserLocationOptions {
  map: google.maps.Map | null;
}

export function useUserLocation({ map }: UseUserLocationOptions) {
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);

  // Get user position on mount
  useEffect(() => {
    let cancelled = false;

    getCurrentPosition()
      .then((location) => {
        if (!cancelled) {
          setCoordinates(location);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // Pan map and add/update blue marker when coordinates arrive
  useEffect(() => {
    if (!map || !coordinates) return;

    map.panTo(coordinates);

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(coordinates);
      userMarkerRef.current.setMap(map);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position: coordinates,
        map,
        title: "Your Location",
        icon: { url: BLUE_DOT_SVG },
      });
    }
  }, [map, coordinates]);

  return { coordinates, loading, error };
}
