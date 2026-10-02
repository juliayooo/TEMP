export const THUMB = 44;
// Sunflower spacing: each point owns an area of PI * SPACING^2, so neighbours sit ~1.77 * SPACING apart.
const SPACING = THUMB / 1.6;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Position of the i-th photo (0 = hottest, at the centre) relative to the map centre. */
export function spiralPosition(i: number) {
  const r = SPACING * Math.sqrt(i + 0.5);
  const a = i * GOLDEN_ANGLE;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

export function mapRadius(count: number) {
  return SPACING * Math.sqrt(count + 0.5) + THUMB;
}

// Cold -> hot.
const SCALE = [
  [43, 58, 158],
  [63, 167, 214],
  [127, 216, 190],
  [246, 226, 122],
  [247, 157, 60],
  [215, 38, 61],
];

/** Colour for a temperature normalised to the 0..1 range of the library. */
export function tempColor(t: number) {
  const x = Math.min(1, Math.max(0, t)) * (SCALE.length - 1);
  const i = Math.min(SCALE.length - 2, Math.floor(x));
  const f = x - i;
  const [r, g, b] = SCALE[i].map((c, k) => Math.round(c + (SCALE[i + 1][k] - c) * f));
  return `rgb(${r},${g},${b})`;
}

export function formatTemp(celsius: number, fahrenheit: boolean) {
  return fahrenheit ? `${Math.round(celsius * 1.8 + 32)}°F` : `${Math.round(celsius)}°C`;
}
