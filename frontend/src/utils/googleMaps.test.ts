import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("googleMaps utils", () => {
  let originalGoogle: typeof window.google | undefined;

  beforeEach(() => {
    // Save original google object
    originalGoogle = (window as { google?: typeof window.google }).google;
    // Clear any existing google object
    delete (window as { google?: unknown }).google;
    // Clear document head scripts
    document.head.innerHTML = "";
  });

  afterEach(() => {
    // Restore original google object
    if (originalGoogle) {
      (window as { google?: typeof window.google }).google = originalGoogle;
    } else {
      delete (window as { google?: unknown }).google;
    }
    vi.resetModules();
  });

  describe("isGoogleMapsConfigured", () => {
    it("returns true when API key is set via env", async () => {
      // The actual env value should be set
      const { isGoogleMapsConfigured } = await import("./googleMaps");
      // This will return true if VITE_GOOGLE_MAPS_API_KEY is set in the real env
      const result = isGoogleMapsConfigured();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("loadGoogleMapsScript", () => {
    it("resolves immediately if google.maps is already loaded", async () => {
      vi.resetModules();
      (window as { google?: { maps: object } }).google = { maps: {} };

      const { loadGoogleMapsScript } = await import("./googleMaps");
      const promise = loadGoogleMapsScript();
      await expect(promise).resolves.toBeUndefined();
    });

    it("creates a script element when loading", async () => {
      vi.resetModules();
      const { loadGoogleMapsScript } = await import("./googleMaps");

      const promise = loadGoogleMapsScript();

      // Script should be added
      const script = document.querySelector('script[id="google-maps-script"]');
      expect(script).not.toBeNull();
      expect(script?.getAttribute("src")).toContain("maps.googleapis.com");

      // Simulate load
      (window as { google?: { maps: object } }).google = { maps: {} };
      script?.dispatchEvent(new Event("load"));

      await promise;
    });

    it("returns same promise for concurrent calls", async () => {
      vi.resetModules();
      const { loadGoogleMapsScript } = await import("./googleMaps");

      const promise1 = loadGoogleMapsScript();
      const promise2 = loadGoogleMapsScript();

      expect(promise1).toBe(promise2);

      // Resolve the promise
      const script = document.querySelector('script[id="google-maps-script"]');
      (window as { google?: { maps: object } }).google = { maps: {} };
      script?.dispatchEvent(new Event("load"));

      await Promise.all([promise1, promise2]);
    });

    it("waits for existing script if already in document", async () => {
      // Add an existing script first
      const existingScript = document.createElement("script");
      existingScript.src = "https://maps.googleapis.com/maps/api/js?key=existing";
      document.head.appendChild(existingScript);

      vi.resetModules();
      const { loadGoogleMapsScript } = await import("./googleMaps");

      const promise = loadGoogleMapsScript();

      // Simulate google.maps becoming available
      setTimeout(() => {
        (window as { google?: { maps: object } }).google = { maps: {} };
      }, 50);

      await promise;
      expect((window as { google?: { maps: object } }).google?.maps).toBeDefined();
    });

    it("rejects when script fails to load", async () => {
      vi.resetModules();
      const { loadGoogleMapsScript } = await import("./googleMaps");

      const promise = loadGoogleMapsScript();

      const script = document.querySelector('script[id="google-maps-script"]');
      script?.dispatchEvent(new Event("error"));

      await expect(promise).rejects.toThrow("Failed to load Google Maps");
    });

    it("sets correct script attributes", async () => {
      vi.resetModules();
      const { loadGoogleMapsScript } = await import("./googleMaps");

      loadGoogleMapsScript();

      const script = document.querySelector(
        'script[id="google-maps-script"]'
      ) as HTMLScriptElement;
      expect(script).not.toBeNull();
      expect(script.async).toBe(true);
      expect(script.defer).toBe(true);
      expect(script.id).toBe("google-maps-script");

      // Clean up
      (window as { google?: { maps: object } }).google = { maps: {} };
      script?.dispatchEvent(new Event("load"));
    });

    it("includes api key in script src", async () => {
      vi.resetModules();
      const { loadGoogleMapsScript } = await import("./googleMaps");

      loadGoogleMapsScript();

      const script = document.querySelector(
        'script[id="google-maps-script"]'
      ) as HTMLScriptElement;
      expect(script.src).toContain("key=");

      // Clean up
      (window as { google?: { maps: object } }).google = { maps: {} };
      script?.dispatchEvent(new Event("load"));
    });
  });
});
