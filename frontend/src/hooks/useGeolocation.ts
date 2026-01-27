import { useState, useEffect, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type { Coordinates } from '../utils/distance';

export interface GeolocationState {
  coordinates: Coordinates | null;
  loading: boolean;
  error: string | null;
  permission: 'granted' | 'denied' | 'prompt' | null;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watchPosition?: boolean; // Enable continuous location updates
}

export interface UseGeolocationReturn extends GeolocationState {
  getCurrentPosition: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for accessing device geolocation with Capacitor support for mobile
 * Falls back to browser Geolocation API for web
 */
export function useGeolocation(
  options: UseGeolocationOptions = {}
): UseGeolocationReturn {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0,
    watchPosition = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    loading: false,
    error: null,
    permission: null,
  });

  const isNative = Capacitor.isNativePlatform();

  /**
   * Request location permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        // Use Capacitor for native platforms
        const permission = await Geolocation.requestPermissions();
        const granted =
          permission.location === 'granted' ||
          permission.coarseLocation === 'granted';

        setState((prev) => ({
          ...prev,
          permission: granted ? 'granted' : 'denied',
        }));

        return granted;
      } else {
        // For web, permission is requested when getting position
        setState((prev) => ({ ...prev, permission: 'granted' }));
        return true;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      setState((prev) => ({
        ...prev,
        permission: 'denied',
        error: 'Failed to request location permission',
      }));
      return false;
    }
  }, [isNative]);

  /**
   * Get current position
   */
  const getCurrentPosition = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      if (isNative) {
        // Use Capacitor Geolocation for native platforms
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy,
          timeout,
          maximumAge,
        });

        setState({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          loading: false,
          error: null,
          permission: 'granted',
        });
      } else {
        // Use browser Geolocation API for web
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by your browser');
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            setState({
              coordinates: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
              loading: false,
              error: null,
              permission: 'granted',
            });
          },
          (error) => {
            let errorMessage = 'Failed to get location';
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied';
                setState((prev) => ({ ...prev, permission: 'denied' }));
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable';
                break;
              case error.TIMEOUT:
                errorMessage = 'Location request timed out';
                break;
            }

            setState((prev) => ({
              ...prev,
              loading: false,
              error: errorMessage,
            }));
          },
          {
            enableHighAccuracy,
            timeout,
            maximumAge,
          }
        );
      }
    } catch (error) {
      console.error('Geolocation error:', error);

      let errorMessage = 'Failed to get location';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [isNative, enableHighAccuracy, timeout, maximumAge]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Check permission on mount
   */
  useEffect(() => {
    const checkPermission = async () => {
      if (isNative) {
        try {
          const permission = await Geolocation.checkPermissions();
          const granted =
            permission.location === 'granted' ||
            permission.coarseLocation === 'granted';

          setState((prev) => ({
            ...prev,
            permission: granted ? 'granted' : 'denied',
          }));
        } catch (error) {
          console.error('Permission check error:', error);
        }
      }
    };

    checkPermission();
  }, [isNative]);

  /**
   * Watch position for continuous updates
   */
  useEffect(() => {
    if (!watchPosition || !state.permission || state.permission !== 'granted') {
      return;
    }

    let watchId: string | number | undefined;

    const startWatching = async () => {
      try {
        if (isNative) {
          // Use Capacitor watch
          watchId = await Geolocation.watchPosition(
            {
              enableHighAccuracy,
              timeout,
              maximumAge,
            },
            (position, error) => {
              if (error) {
                console.error('Watch position error:', error);
                setState((prev) => ({
                  ...prev,
                  error: 'Failed to watch location',
                }));
                return;
              }

              if (position) {
                setState((prev) => ({
                  ...prev,
                  coordinates: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  },
                  error: null,
                }));
              }
            }
          );
        } else {
          // Use browser watch
          if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
              (position) => {
                setState((prev) => ({
                  ...prev,
                  coordinates: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  },
                  error: null,
                }));
              },
              (error) => {
                console.error('Watch position error:', error);
              },
              {
                enableHighAccuracy,
                timeout,
                maximumAge,
              }
            );
          }
        }
      } catch (error) {
        console.error('Failed to start watching position:', error);
      }
    };

    startWatching();

    return () => {
      // Cleanup watch on unmount
      if (watchId !== undefined) {
        if (isNative) {
          Geolocation.clearWatch({ id: watchId as string });
        } else {
          navigator.geolocation.clearWatch(watchId as number);
        }
      }
    };
  }, [
    watchPosition,
    state.permission,
    isNative,
    enableHighAccuracy,
    timeout,
    maximumAge,
  ]);

  return {
    ...state,
    getCurrentPosition,
    requestPermission,
    clearError,
  };
}
