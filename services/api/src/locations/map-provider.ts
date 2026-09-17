export type DirectionsMode = 'WALKING' | 'DRIVING' | 'TRANSIT';

export type MapCoordinates = {
  latitude: number;
  longitude: number;
  name?: string;
};

export interface MapProvider {
  readonly name: string;
  openDirections(from: MapCoordinates | null, to: MapCoordinates, mode?: DirectionsMode): Promise<string>;
  openLocation(target: MapCoordinates): Promise<string>;
  generateMapUrl(target: MapCoordinates): string;
}

export class AppleMapsProvider implements MapProvider {
  readonly name = 'apple';

  generateMapUrl(target: MapCoordinates): string {
    const query = encodeURIComponent(target.name ?? `${target.latitude},${target.longitude}`);
    return `https://maps.apple.com/?ll=${target.latitude},${target.longitude}&q=${query}`;
  }

  async openLocation(target: MapCoordinates): Promise<string> {
    return this.generateMapUrl(target);
  }

  async openDirections(from: MapCoordinates | null, to: MapCoordinates, mode: DirectionsMode = 'WALKING'): Promise<string> {
    const dirflg = mode === 'DRIVING' ? 'd' : mode === 'TRANSIT' ? 'r' : 'w';
    const destination = encodeURIComponent(to.name ?? `${to.latitude},${to.longitude}`);
    const origin = from ? `&saddr=${encodeURIComponent(from.name ?? `${from.latitude},${from.longitude}`)}` : '';
    return `https://maps.apple.com/?daddr=${destination}${origin}&dirflg=${dirflg}`;
  }
}

export class GoogleMapsProvider implements MapProvider {
  readonly name = 'google';

  generateMapUrl(target: MapCoordinates): string {
    return `https://www.google.com/maps/search/?api=1&query=${target.latitude},${target.longitude}`;
  }

  async openLocation(target: MapCoordinates): Promise<string> {
    return this.generateMapUrl(target);
  }

  async openDirections(from: MapCoordinates | null, to: MapCoordinates, mode: DirectionsMode = 'WALKING'): Promise<string> {
    const travelmode = mode.toLowerCase();
    const origin = from ? `&origin=${from.latitude},${from.longitude}` : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${to.latitude},${to.longitude}${origin}&travelmode=${travelmode}`;
  }
}

export class OpenStreetMapProvider implements MapProvider {
  readonly name = 'osm';

  generateMapUrl(target: MapCoordinates): string {
    return `https://www.openstreetmap.org/?mlat=${target.latitude}&mlon=${target.longitude}#map=18/${target.latitude}/${target.longitude}`;
  }

  async openLocation(target: MapCoordinates): Promise<string> {
    return this.generateMapUrl(target);
  }

  async openDirections(from: MapCoordinates | null, to: MapCoordinates): Promise<string> {
    if (!from) {
      return this.generateMapUrl(to);
    }
    return `https://www.openstreetmap.org/directions?from=${from.latitude},${from.longitude}&to=${to.latitude},${to.longitude}`;
  }
}

export function mapProviderFor(name: string): MapProvider {
  switch (name) {
    case 'google':
      return new GoogleMapsProvider();
    case 'osm':
      return new OpenStreetMapProvider();
    default:
      return new AppleMapsProvider();
  }
}
