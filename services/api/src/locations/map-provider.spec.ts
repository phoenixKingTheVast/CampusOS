import { AppleMapsProvider, GoogleMapsProvider, OpenStreetMapProvider, mapProviderFor } from './map-provider';

const engineering = { latitude: -17.7842, longitude: 31.0534, name: 'Engineering Building' };

describe('map providers', () => {
  it('keeps routing behind a provider abstraction', () => {
    expect(mapProviderFor('apple')).toBeInstanceOf(AppleMapsProvider);
    expect(mapProviderFor('google')).toBeInstanceOf(GoogleMapsProvider);
    expect(mapProviderFor('osm')).toBeInstanceOf(OpenStreetMapProvider);
  });

  it('opens directions without CampusOS calculating the route', async () => {
    const apple = new AppleMapsProvider();
    const url = await apple.openDirections(null, engineering, 'WALKING');
    expect(url).toContain('maps.apple.com');
    expect(url).toContain('daddr=');
    expect(url).toContain('dirflg=w');
    expect(apple.generateMapUrl(engineering)).toContain('-17.7842,31.0534');
  });

  it('can switch to Google or OSM without changing the location model', async () => {
    const google = new GoogleMapsProvider();
    const osm = new OpenStreetMapProvider();
    expect(await google.openLocation(engineering)).toContain('google.com/maps');
    expect(await osm.openLocation(engineering)).toContain('openstreetmap.org');
  });
});
