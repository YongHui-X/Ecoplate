import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Capacitor core
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => "web",
  },
}));

// Mock Capacitor plugins
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    getCurrentPosition: vi.fn().mockResolvedValue({
      coords: { latitude: 1.3521, longitude: 103.8198 },
    }),
    checkPermissions: vi.fn().mockResolvedValue({ location: "granted" }),
    requestPermissions: vi.fn().mockResolvedValue({ location: "granted" }),
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
    exitApp: vi.fn(),
  },
}));

vi.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setStyle: vi.fn(),
    setBackgroundColor: vi.fn(),
  },
  Style: {
    Light: "LIGHT",
    Dark: "DARK",
  },
}));

vi.mock("@capacitor/splash-screen", () => ({
  SplashScreen: {
    hide: vi.fn(),
  },
}));

vi.mock("@capacitor/keyboard", () => ({
  Keyboard: {
    addListener: vi.fn(),
  },
}));

vi.mock("@capacitor/haptics", () => ({
  Haptics: {
    impact: vi.fn(),
  },
  ImpactStyle: {
    Light: "LIGHT",
    Medium: "MEDIUM",
    Heavy: "HEAVY",
  },
}));

// Mock Leaflet for tests
vi.mock("leaflet", () => {
  const MockIcon = vi.fn().mockImplementation(() => ({
    options: {},
  }));

  // Create a proper Default class with prototype
  class DefaultIcon {
    static mergeOptions = vi.fn();
    static imagePath = "";
    _getIconUrl?: () => string;
  }

  (MockIcon as typeof MockIcon & { Default: typeof DefaultIcon }).Default = DefaultIcon;

  return {
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
  };
});

// Mock react-leaflet
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({
    setView: vi.fn(),
  }),
}));
