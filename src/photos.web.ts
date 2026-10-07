// Browsers can't read a photo library, so the web build fills the map with
// generated stand-in photos. It exists to try the layout and interactions on a
// computer, not as a real web version of the app.
import type { PhotoPoint, Progress } from './photos';

export type { PhotoPoint, Progress } from './photos';

export const MAX_PHOTOS = 600;

export async function requestAccess() {
  return true;
}

function placeholder(hue: number, aspect: number) {
  const w = Math.round(120 * aspect);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="120">` +
    `<rect width="100%" height="100%" fill="hsl(${hue},55%,55%)"/>` +
    `<circle cx="${w / 2}" cy="60" r="24" fill="hsl(${(hue + 40) % 360},70%,80%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function loadPhotos(
  onUpdate: (photos: PhotoPoint[], progress: Progress) => void,
  isCancelled: () => boolean,
  onPlaced?: (count: number) => void
) {
  const photos: PhotoPoint[] = [];
  // A fixed seed, so every run lays out the same map.
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < MAX_PHOTOS && !isCancelled(); i++) {
    const aspect = [0.75, 1, 1.33][Math.floor(random() * 3)];
    photos.push({
      id: `fake-${i}`,
      uri: placeholder(Math.floor(random() * 360), aspect),
      time: Date.UTC(2024, 0, 1) + i * 86400000,
      aspect,
      latitude: 40 + random(),
      longitude: -74 + random(),
      temp: -5 + random() * 40,
    });
    onPlaced?.(photos.length);
    if (i % 100 === 99) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  onUpdate(photos, { scanned: photos.length, noLocation: 0, noWeather: 0 });
}
