import { Router, json, error, parseBody } from "../utils/router";
import { z } from "zod";

function getGoogleMapsApiKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY || "";
}

// Request schemas
const autocompleteSchema = z.object({
  query: z.string().min(1),
  country: z.string().length(2).default("sg"),
});

const placeDetailsSchema = z.object({
  placeId: z.string().min(1),
});

// Response types from Google Places API
interface GoogleAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GoogleAutocompleteResponse {
  status: string;
  predictions: GoogleAutocompletePrediction[];
  error_message?: string;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  };
  error_message?: string;
}

export function registerMapsRoutes(router: Router) {
  // Autocomplete endpoint - proxies to Google Places Autocomplete API
  router.post("/api/v1/maps/autocomplete", async (req) => {
    try {
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        return error("Google Maps API key not configured", 500);
      }

      const body = await parseBody(req);
      const data = autocompleteSchema.parse(body);

      const url = new URL(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json"
      );
      url.searchParams.set("input", data.query);
      url.searchParams.set("components", `country:${data.country}`);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      const result = (await response.json()) as GoogleAutocompleteResponse;

      if (result.status !== "OK" && result.status !== "ZERO_RESULTS") {
        console.error("Google Places Autocomplete error:", result.error_message);
        return error(
          result.error_message || "Failed to fetch autocomplete suggestions",
          502
        );
      }

      // Transform to simplified response format
      const predictions = (result.predictions || []).map((p) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
      }));

      return json({ predictions });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Maps autocomplete error:", e);
      return error("Failed to fetch location suggestions", 500);
    }
  });

  // Place Details endpoint - proxies to Google Place Details API
  router.post("/api/v1/maps/place-details", async (req) => {
    try {
      const apiKey = getGoogleMapsApiKey();
      if (!apiKey) {
        return error("Google Maps API key not configured", 500);
      }

      const body = await parseBody(req);
      const data = placeDetailsSchema.parse(body);

      const url = new URL(
        "https://maps.googleapis.com/maps/api/place/details/json"
      );
      url.searchParams.set("place_id", data.placeId);
      url.searchParams.set("fields", "geometry,formatted_address");
      url.searchParams.set("key", apiKey);

      const response = await fetch(url.toString());
      const result = (await response.json()) as GooglePlaceDetailsResponse;

      if (result.status !== "OK") {
        console.error("Google Place Details error:", result.error_message);
        return error(
          result.error_message || "Failed to fetch place details",
          502
        );
      }

      if (!result.result) {
        return error("Place not found", 404);
      }

      return json({
        address: result.result.formatted_address,
        latitude: result.result.geometry.location.lat,
        longitude: result.result.geometry.location.lng,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return error(e.errors[0].message, 400);
      }
      console.error("Maps place details error:", e);
      return error("Failed to fetch place details", 500);
    }
  });
}
