// Historical temperature lookup via Open-Meteo (free, no API key).
// Archive data goes back to 1940 but lags a few days, so recent dates use the forecast endpoint.

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_LAG_MS = 6 * 24 * 60 * 60 * 1000;
const EARLIEST_MS = Date.UTC(1940, 0, 1);

type HourlyTemps = (number | null)[];

// Photos taken on the same day within ~11km share one request.
const dayCache = new Map<string, Promise<HourlyTemps | null>>();

async function fetchDay(lat: string, lon: string, date: string, recent: boolean) {
  const url =
    `${recent ? FORECAST_URL : ARCHIVE_URL}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${date}&end_date=${date}&hourly=temperature_2m`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  return (json?.hourly?.temperature_2m as HourlyTemps | undefined) ?? null;
}

/** Temperature in °C at the given place and time, or null if unavailable. */
export async function temperatureAt(
  latitude: number,
  longitude: number,
  timeMs: number
): Promise<number | null> {
  const now = Date.now();
  if (timeMs < EARLIEST_MS || timeMs > now) return null;

  const when = new Date(timeMs);
  const date = when.toISOString().slice(0, 10);
  const lat = latitude.toFixed(1);
  const lon = longitude.toFixed(1);
  const key = `${lat},${lon},${date}`;

  let day = dayCache.get(key);
  if (!day) {
    day = fetchDay(lat, lon, date, now - timeMs < ARCHIVE_LAG_MS).catch(() => {
      dayCache.delete(key);
      return null;
    });
    dayCache.set(key, day);
  }
  const temps = await day;
  return temps?.[when.getUTCHours()] ?? null;
}
