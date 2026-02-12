import { api } from './api';

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  address: string;
  latitude: number;
  longitude: number;
}

interface AutocompleteResponse {
  predictions: PlacePrediction[];
}

export const mapsService = {
  /**
   * Get autocomplete suggestions for a location query
   * @param query The search query (partial address or place name)
   * @param country ISO 3166-1 Alpha-2 country code (defaults to 'sg' for Singapore)
   */
  async getAutocompleteSuggestions(
    query: string,
    country: string = 'sg'
  ): Promise<PlacePrediction[]> {
    const response = await api.post<AutocompleteResponse>('/maps/autocomplete', {
      query,
      country,
    });
    return response.predictions;
  },

  /**
   * Get place details (address and coordinates) for a place ID
   * @param placeId Google Place ID from autocomplete suggestions
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    return api.post<PlaceDetails>('/maps/place-details', { placeId });
  },
};
