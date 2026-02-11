/**
 * Shared Google Maps script loader utility.
 * Ensures the script is only loaded once across all components.
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let loadPromise: Promise<void> | null = null;

/**
 * Wait for Google Maps Places library to be available
 */
function waitForPlaces(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (window.google?.maps?.places) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error("Timeout waiting for Google Maps Places library"));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

/**
 * Load Google Maps JavaScript API with Places library.
 * This function ensures the script is only loaded once.
 */
export function loadGoogleMapsScript(): Promise<void> {
  // Return existing promise if already loading/loaded
  if (loadPromise) {
    return loadPromise;
  }

  // Already fully loaded with Places
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check for any existing Google Maps script
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');

    if (existingScript) {
      // Script exists - wait for Places library to be available
      waitForPlaces()
        .then(resolve)
        .catch(reject);
      return;
    }

    // Load new script with Places library
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Wait for Places to be fully initialized
      waitForPlaces()
        .then(resolve)
        .catch(reject);
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
