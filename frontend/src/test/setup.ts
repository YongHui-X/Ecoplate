import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock ResizeObserver for Recharts and other components that use it
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Suppress Recharts width/height warnings in tests (jsdom limitation)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress Recharts dimension warnings
  console.error = (...args: unknown[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('width') && message.includes('height')) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    const message = args[0];
    if (typeof message === 'string' && message.includes('width') && message.includes('height')) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
});

afterEach(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Setup portal container for Radix UI dialogs before each test
beforeEach(() => {
  // Create a portal root for Radix UI components (Dialog, Popover, etc.)
  const portalRoot = document.createElement('div');
  portalRoot.setAttribute('id', 'radix-portal');
  document.body.appendChild(portalRoot);
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Remove any portal elements created during tests
  document.body.innerHTML = '';
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
