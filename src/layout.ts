import type { PhotoPoint } from './photos';

export const COLORS = {
  background: '#FFFFFF',
  hot: '#FCA11D',
  warm: '#F28A32',
  mid: '#D67B4E',
  cool: '#7059AF',
  cold: '#675FC6',
  fade: '#E8E9F4',
  glow: '#FF892A',
  blue: '#1538FF',
  text: '#888888',
  active: '#FCA11E',
};

/** Degrees Celsius between candidate rings. */
const RING_STEP = 5;
/** Rings closer together than this are skipped so their labels don't collide. */
const MIN_RING_GAP = 34;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// Photos may overlap a little at the edges, like a collage.
const FOOTPRINT = 0.85;
const CELL = 128;

const MIN_SIZE = 44;
const SIZE_RANGE = 76;
/** Mean of size² over the distribution in `thumbSize`. */
const MEAN_SQUARE_SIZE = MIN_SIZE ** 2 + (2 * MIN_SIZE * SIZE_RANGE) / 3 + SIZE_RANGE ** 2 / 5;
/** Canvas area given to each photo; the same everywhere, so no part of the map is crowded. */
const AREA_PER_PHOTO = MEAN_SQUARE_SIZE * 1.5;
/** Empty disc in the middle, where the spokes converge. */
const INNER_RADIUS = 48;
const MARGIN = 140;

export type Placed = { photo: PhotoPoint; x: number; y: number; w: number; h: number };
export type Ring = { r: number; temp: number };

export type ChartLayout = {
  /** Half the side of the square canvas. */
  half: number;
  rings: Ring[];
  /** Largest photos first, so small ones are drawn on top of them. */
  items: Placed[];
};

/** Stable pseudo-random number in [0, 1) for a photo, so its size never changes. */
function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function thumbSize(id: string) {
  return MIN_SIZE + SIZE_RANGE * hash(id) ** 2;
}

/** Radius that encloses the `rank` hottest photos. */
function rankRadius(rank: number) {
  return Math.sqrt(INNER_RADIUS ** 2 + (rank * AREA_PER_PHOTO) / Math.PI);
}

/**
 * Radial chart ordered by temperature: the hottest photo sits next to the
 * centre and each colder one a little further out, with photos spread at an
 * even density. Rings are isotherms, so their spacing shows how many photos
 * fall between two temperatures. The angle carries no meaning.
 */
export function layoutChart(photos: PhotoPoint[]): ChartLayout {
  const sorted = [...photos].sort((a, b) => b.temp - a.temp);
  const radius = rankRadius(sorted.length);

  const rings: Ring[] = [];
  if (sorted.length > 0) {
    const max = sorted[0].temp;
    const min = sorted[sorted.length - 1].temp;
    rings.push({ r: INNER_RADIUS, temp: max });
    let rank = 0;
    for (let temp = Math.floor(max / RING_STEP) * RING_STEP; temp > min; temp -= RING_STEP) {
      while (rank < sorted.length && sorted[rank].temp > temp) rank++;
      const r = rankRadius(rank);
      if (r - rings[rings.length - 1].r >= MIN_RING_GAP && radius - r >= MIN_RING_GAP) {
        rings.push({ r, temp });
      }
    }
    rings.push({ r: radius, temp: min });
  }

  const grid = new Map<string, Placed[]>();
  const collides = (x: number, y: number, w: number, h: number) => {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        for (const o of grid.get(`${gx},${gy}`) ?? []) {
          if (
            Math.abs(o.x - x) < ((o.w + w) / 2) * FOOTPRINT &&
            Math.abs(o.y - y) < ((o.h + h) / 2) * FOOTPRINT
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const items = sorted.map((photo, i) => {
    const ideal = rankRadius(i + 0.5);
    const size = thumbSize(photo.id);
    const aspect = Math.sqrt(Math.min(1.4, Math.max(0.7, photo.aspect)));
    const w = size * aspect;
    const h = size / aspect;
    const base = i * GOLDEN_ANGLE;

    let x = ideal * Math.cos(base);
    let y = ideal * Math.sin(base);
    search: for (let nudge = 0; nudge < 16; nudge++) {
      // Drift off the ideal radius only when there is no free spot on it.
      const r = Math.max(
        INNER_RADIUS,
        ideal + (nudge % 2 ? -1 : 1) * Math.ceil(nudge / 2) * 10
      );
      for (let turn = 0; turn < 24; turn++) {
        const a = base + turn * GOLDEN_ANGLE;
        const tx = r * Math.cos(a);
        const ty = r * Math.sin(a);
        if (!collides(tx, ty, w, h)) {
          x = tx;
          y = ty;
          break search;
        }
      }
    }

    const placed: Placed = { photo, x, y, w, h };
    const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    const cell = grid.get(key);
    if (cell) cell.push(placed);
    else grid.set(key, [placed]);
    return placed;
  });
  items.sort((a, b) => b.w * b.h - a.w * a.h);

  return { half: radius + MARGIN, rings, items };
}

function mix(a: string, b: string, f: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Colour for a temperature normalised to 0 (coldest) .. 1 (hottest). */
export function tempColor(t: number) {
  const x = Math.min(1, Math.max(0, t));
  const scale = [COLORS.cold, COLORS.cool, COLORS.mid, COLORS.warm, COLORS.hot];
  const i = Math.min(scale.length - 2, Math.floor(x * (scale.length - 1)));
  return mix(scale[i], scale[i + 1], x * (scale.length - 1) - i);
}

export function formatTemp(celsius: number, fahrenheit: boolean) {
  return `${Math.round(fahrenheit ? celsius * 1.8 + 32 : celsius)}°`;
}
