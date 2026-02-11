/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ECOPLATE_URL: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Maps types
declare namespace google.maps {
  class Map {
    constructor(element: HTMLElement, options?: MapOptions);
    panTo(latLng: LatLngLiteral): void;
    setZoom(zoom: number): void;
    getZoom(): number | undefined;
  }

  class Marker {
    constructor(options?: MarkerOptions);
    setPosition(latLng: LatLngLiteral): void;
    setMap(map: Map | null): void;
    setIcon(icon: Icon | string): void;
    addListener(event: string, handler: () => void): void;
  }

  class InfoWindow {
    constructor(options?: InfoWindowOptions);
    setContent(content: string | HTMLElement): void;
    open(map: Map, anchor?: Marker): void;
    close(): void;
  }

  class Circle {
    constructor(options?: CircleOptions);
    setCenter(center: LatLngLiteral): void;
    setRadius(radius: number): void;
    setMap(map: Map | null): void;
  }

  class LatLngBounds {
    constructor();
    extend(latLng: LatLngLiteral): void;
  }

  class Size {
    constructor(width: number, height: number);
  }

  class Point {
    constructor(x: number, y: number);
  }

  namespace event {
    function addListener(instance: object, event: string, handler: () => void): MapsEventListener;
    function removeListener(listener: MapsEventListener): void;
  }

  interface MapsEventListener {
    remove(): void;
  }

  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    streetViewControl?: boolean;
    mapTypeControl?: boolean;
    fullscreenControl?: boolean;
  }

  interface MarkerOptions {
    position?: LatLngLiteral;
    map?: Map | null;
    title?: string;
    icon?: Icon | string;
  }

  interface Icon {
    url: string;
    scaledSize?: Size;
    anchor?: Point;
  }

  interface InfoWindowOptions {
    content?: string | HTMLElement;
  }

  interface CircleOptions {
    map?: Map;
    center?: LatLngLiteral;
    radius?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }
}

interface Window {
  google?: {
    maps?: typeof google.maps;
  };
}
