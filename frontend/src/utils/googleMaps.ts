/**
 * Shared Google Maps script loader utility.
 * Used only for map rendering in MarketplaceMap.
 * Location autocomplete now uses backend proxy to Google Places API.
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let loadPromise: Promise<void> | null = null;

/**
 * Load Google Maps JavaScript API.
 * This function ensures the script is only loaded once.
 * Used for map rendering, not for Places API calls (those go through backend).
 */
export function loadGoogleMapsScript(): Promise<void> {
  // Return existing promise if already loading/loaded
  if (loadPromise) {
    return loadPromise;
  }

  // Already fully loaded
  if (window.google?.maps) {
    return Promise.resolve();
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check for any existing Google Maps script
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');

    if (existingScript) {
      // Script exists - wait for google.maps to be available
      const check = () => {
        if (window.google?.maps) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
      return;
    }

    // Load new script (without places library - not needed for map display only)
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const check = () => {
        if (window.google?.maps) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    };

    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Check if Google Maps API key is configured
 */
export function isGoogleMapsConfigured(): boolean {
  return !!GOOGLE_MAPS_API_KEY;
}
