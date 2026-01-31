import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Capacitor for tests
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
  },
}));

// Mock Leaflet for tests
vi.mock('leaflet', () => ({
  default: {},
  Icon: {
    Default: {
      imagePath: '',
    },
  },
  Map: vi.fn(),
  TileLayer: vi.fn(),
  Marker: vi.fn(),
  marker: vi.fn(),
  map: vi.fn(),
  tileLayer: vi.fn(),
}));
