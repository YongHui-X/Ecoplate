import '@testing-library/jest-dom';
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
const MockIcon = vi.fn().mockImplementation(() => ({
  options: {},
}));
(MockIcon as unknown as { Default: { mergeOptions: ReturnType<typeof vi.fn>; imagePath: string } }).Default = {
  mergeOptions: vi.fn(),
  imagePath: '',
};

vi.mock('leaflet', () => ({
  default: {
    Icon: MockIcon,
    map: vi.fn(),
    tileLayer: vi.fn(),
    marker: vi.fn(),
    latLng: vi.fn(),
    latLngBounds: vi.fn(),
    point: vi.fn(),
  },
  Icon: MockIcon,
  Map: vi.fn(),
  TileLayer: vi.fn(),
  Marker: vi.fn(),
  marker: vi.fn(),
  map: vi.fn(),
  tileLayer: vi.fn(),
  latLng: vi.fn(),
  latLngBounds: vi.fn(),
  point: vi.fn(),
}));
