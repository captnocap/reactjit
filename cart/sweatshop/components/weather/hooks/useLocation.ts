const React: any = require('react');
const { useEffect, useState } = React;

const STORE_KEY = 'sweatshop.weather.location';

export type WeatherLocation = {
  city: string;
  lat?: number;
  lon?: number;
  name?: string;
  country?: string;
  state?: string;
  units: 'metric' | 'imperial';
};

function loadLocation(): WeatherLocation {
  try {
    const raw = (globalThis as any).__store_get?.(STORE_KEY);
    if (raw) return { units: 'metric', city: '', ...JSON.parse(raw) };
  } catch {}
  return { city: 'San Francisco', units: 'metric' };
}

function saveLocation(location: WeatherLocation): void {
  try { (globalThis as any).__store_set?.(STORE_KEY, JSON.stringify(location)); } catch {}
}

export function useLocation() {
  const [location, setLocation] = useState<WeatherLocation>(() => loadLocation());

  useEffect(() => { saveLocation(location); }, [location.city, location.lat, location.lon, location.name, location.country, location.state, location.units]);

  function setCity(city: string) {
    setLocation((prev) => ({ ...prev, city, lat: undefined, lon: undefined, name: undefined, country: undefined, state: undefined }));
  }

  function setResolved(next: Partial<WeatherLocation>) {
    setLocation((prev) => ({ ...prev, ...next }));
  }

  function setUnits(units: 'metric' | 'imperial') {
    setLocation((prev) => ({ ...prev, units }));
  }

  return { location, setCity, setResolved, setUnits };
}
