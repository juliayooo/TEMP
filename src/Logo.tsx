import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { COLORS } from './layout';

// Traced from design/Headernew.svg, shifted to start at the origin.
const WIDTH = 279;
const HEIGHT = 67.2;

const LETTERS = [
  {
    d: 'M32.77 12.6V64.66C32.77 66.06 31.63 67.2 30.23 67.2H22.16C20.76 67.2 19.62 66.06 19.62 64.66V12.97C19.62 8.95 16.43 5.65 12.41 5.51L2.45 5.17C1.08 5.13 0 4.01 0 2.64C0 1.23 1.14 0.09 2.54 0.09H51.46C52.86 0.09 54 1.23 54 2.63C54 4 52.91 5.12 51.54 5.17L39.61 5.54C35.8 5.66 32.78 8.78 32.78 12.59L32.77 12.6Z',
    cx: 27,
    r: 30.45,
  },
  {
    d: 'M59.54 0L117.52 0.09C118.9 0.09 120.02 1.19 120.05 2.57V3.16C120.1 4.58 118.95 5.76 117.52 5.76H91.61C88.05 5.76 85.17 8.64 85.17 12.2V24.03C85.17 26.88 87.48 29.18 90.32 29.18H108.74C110.14 29.18 111.28 30.32 111.28 31.72V32.4C111.28 33.8 110.14 34.94 108.74 34.94H91.22C87.88 34.94 85.17 37.65 85.17 40.99V58.19C85.17 59.98 86.62 61.43 88.41 61.43L120.41 61.11C121.82 61.1 122.97 62.24 122.97 63.65V64.55C122.97 65.95 121.84 67.09 120.43 67.09L59.51 67.18C58.11 67.18 56.97 66.04 56.97 64.64V2.54C57 1.14 58.14 0 59.54 0Z',
    cx: 90,
    r: 33.3,
  },
  {
    d: 'M218 2.54V64.66C218 66.06 216.86 67.2 215.46 67.2H189.75C188.35 67.2 187.21 66.06 187.21 64.66V28.31C187.21 24.72 182.34 23.62 180.8 26.87L162.37 65.75C161.95 66.64 161.06 67.2 160.08 67.2H159.26C158.28 67.2 157.39 66.63 156.97 65.75L139.26 28.4C137.57 24.83 132.22 26.04 132.22 29.98V64.66C132.22 66.06 131.08 67.2 129.68 67.2H128.52C127.12 67.2 125.98 66.06 125.98 64.66V2.54C125.98 1.14 127.12 0 128.52 0H139.16C140.14 0 141.04 0.57 141.46 1.45L159.02 38.63C160.89 42.59 166.52 42.58 168.39 38.63L185.85 1.46C186.27 0.57 187.16 0 188.15 0H215.46C216.86 0 218 1.14 218 2.54Z',
    cx: 171.98,
    r: 40.29,
  },
  {
    d: 'M279 18.09C279 31.72 276.21 38.01 260.18 38.01H244.38C242.98 38.01 241.84 39.15 241.84 40.55V64.65C241.84 66.05 240.7 67.19 239.3 67.19H224.54C223.14 67.19 222 66.05 222 64.65V2.54C222 1.14 223.14 0 224.54 0H260.18C276.21 0 279 4.46 279 18.09ZM270.83 16.8C270.83 8.74 266.7 5.76 260.17 5.76H244.37C242.97 5.76 241.83 6.9 241.83 8.3V29.72C241.83 31.12 242.97 32.26 244.37 32.26H260.17C266.7 32.26 270.83 28.9 270.83 20.84V16.81V16.8Z',
    cx: 250.5,
    r: 31.15,
  },
];
const CY = 33.6;

const STOPS: [number, string][] = [
  [0, '#FBAE17'],
  [0.36, '#FBAC17'],
  [0.49, '#FBA51B'],
  [0.58, '#FD9921'],
  [0.65, '#FF892A'],
  [0.72, '#D67B4E'],
  [0.87, '#7158AA'],
  [1, '#1538FF'],
];

/** The TEMP wordmark: each letter glows orange from its middle out to blue, or plain white. */
export function Logo({ width, variant = 'gradient' }: { width: number; variant?: 'gradient' | 'white' }) {
  const height = (width * HEIGHT) / WIDTH;
  return (
    // The glow is a live shadow; it is only used on the static landing screen,
    // never over the moving map, where it would be re-rendered every frame.
    <View style={[{ width, height }, variant === 'gradient' && styles.glow]}>
      <Svg width={width} height={height} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {variant === 'gradient' && (
          <Defs>
            {LETTERS.map((letter, i) => (
              <RadialGradient
                key={i}
                id={`letter${i}`}
                cx={letter.cx}
                cy={CY}
                r={letter.r}
                gradientUnits="userSpaceOnUse">
                {STOPS.map(([offset, color]) => (
                  <Stop key={offset} offset={offset} stopColor={color} />
                ))}
              </RadialGradient>
            ))}
          </Defs>
        )}
        {LETTERS.map((letter, i) => (
          <Path key={i} d={letter.d} fill={variant === 'gradient' ? `url(#letter${i})` : '#fff'} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // The design's orange drop shadow; iOS traces it around the letters.
  glow: {
    shadowColor: COLORS.glow,
    shadowOpacity: 0.74,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
