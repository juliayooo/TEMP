import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Asset,
  AssetField,
  MediaType,
  Query,
  requestPermissionsAsync,
} from 'expo-media-library';

import { temperatureAt } from './weather';

export type PhotoPoint = {
  id: string;
  uri: string;
  time: number;
  /** width / height */
  aspect: number;
  latitude: number;
  longitude: number;
  /** °C */
  temp: number;
};

export type Progress = { scanned: number; noLocation: number; noWeather: number };

/** Upper bound on photos placed on the map, newest first. */
export const MAX_PHOTOS = 600;

/** At most one photo is kept from each window of this length, so bursts don't flood the map. */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

const PAGE_SIZE = 200;
const CONCURRENCY = 4;
const CACHE_KEY = 'photo-temps-v1';

// id -> [temp, latitude, longitude], or 0 for photos without a location.
type Cache = Record<string, [number, number, number] | 0>;

async function readCache(): Promise<Cache> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? '{}');
  } catch {
    return {};
  }
}

async function mapPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let next = 0;
  const run = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
}

/** Asks for photo library access; true if granted. */
export async function requestAccess() {
  return (await requestPermissionsAsync()).granted;
}

/**
 * Walks the photo library newest-first, resolving each photo's location and the
 * temperature there when it was taken. Calls `onUpdate` after every page and
 * `onPlaced` with the running count after every photo that makes it onto the map.
 */
export async function loadPhotos(
  onUpdate: (photos: PhotoPoint[], progress: Progress) => void,
  isCancelled: () => boolean,
  onPlaced?: (count: number) => void
) {
  const cache = await readCache();
  const photos: PhotoPoint[] = [];
  const usedWindows = new Set<number>();
  const progress: Progress = { scanned: 0, noLocation: 0, noWeather: 0 };

  for (let offset = 0; photos.length < MAX_PHOTOS; offset += PAGE_SIZE) {
    const page = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(PAGE_SIZE)
      .offset(offset)
      .exeForMetadata();
    if (page.length === 0 || isCancelled()) break;

    await mapPool(page, async (meta) => {
      if (isCancelled() || photos.length >= MAX_PHOTOS) return;
      let time = meta.creationTime ?? 0;
      if (time < 1e11) time *= 1000; // seconds -> ms
      const window = Math.floor(time / DEDUPE_WINDOW_MS);
      if (usedWindows.has(window)) return;
      progress.scanned++;
      try {
        const asset = new Asset(meta.id);
        let entry = cache[meta.id];
        if (entry === undefined) {
          const location = await asset.getLocation();
          // (0, 0) is what untagged photos report on some devices.
          if (!location || (location.latitude === 0 && location.longitude === 0)) {
            cache[meta.id] = 0;
            progress.noLocation++;
            return;
          }
          const temp = await temperatureAt(location.latitude, location.longitude, time);
          if (temp === null) {
            progress.noWeather++;
            return;
          }
          entry = cache[meta.id] = [temp, location.latitude, location.longitude];
        }
        if (entry === 0) {
          progress.noLocation++;
          return;
        }
        // Claim the window before awaiting so a concurrent worker can't also place one.
        if (usedWindows.has(window)) return;
        usedWindows.add(window);
        const uri = await asset.getUri();
        photos.push({
          id: meta.id,
          uri,
          time,
          aspect: meta.width && meta.height ? meta.width / meta.height : 1,
          temp: entry[0],
          latitude: entry[1],
          longitude: entry[2],
        });
        onPlaced?.(photos.length);
      } catch {
        progress.noWeather++;
      }
    });

    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
    if (isCancelled()) break;
    onUpdate([...photos], { ...progress });
    if (page.length < PAGE_SIZE) break;
  }
}
