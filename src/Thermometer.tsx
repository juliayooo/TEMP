import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { COLORS } from './layout';

// Drawn in the coordinates of design/Mobile - Landingnew.svg, cropped by the viewBox.
const VIEW_X = 176;
const VIEW_Y = 461;
const WIDTH = 34;
const HEIGHT = 72;
const OUTLINE =
  'M201.851 504.015V471.2C201.851 469.268 201.083 467.415 199.716 466.048C198.35 464.682 196.496 463.914 194.563 463.914C192.631 463.914 190.777 464.682 189.411 466.048C188.044 467.415 187.276 469.268 187.276 471.2V504.015C184.936 505.578 183.161 507.852 182.213 510.501C181.265 513.15 181.194 516.034 182.011 518.726C182.828 521.418 184.489 523.777 186.75 525.453C189.01 527.129 191.749 528.033 194.563 528.033C197.378 528.033 200.117 527.129 202.377 525.453C204.638 523.777 206.299 521.418 207.116 518.726C207.933 516.034 207.862 513.15 206.914 510.501C205.966 507.852 204.191 505.578 201.851 504.015Z';
const SHADOW =
  'M198.809 506.072V473.257C198.809 471.325 198.041 469.472 196.675 468.105C195.308 466.739 193.454 465.971 191.522 465.971C189.589 465.971 187.735 466.739 186.369 468.105C185.002 469.472 184.234 471.325 184.234 473.257V506.072C181.895 507.635 180.119 509.909 179.171 512.558C178.223 515.207 178.152 518.091 178.969 520.783C179.786 523.475 181.447 525.834 183.708 527.51C185.968 529.186 188.708 530.091 191.522 530.091C194.336 530.091 197.075 529.186 199.336 527.51C201.596 525.834 203.257 523.475 204.074 520.783C204.891 518.091 204.82 515.207 203.872 512.558C202.924 509.909 201.149 507.635 198.809 506.072Z';

// The liquid rises from inside the bulb to just under the top of the tube.
const LIQUID_WIDTH = 7;
const LIQUID_BOTTOM = 508 - VIEW_Y;
const LIQUID_MAX = LIQUID_BOTTOM - (468 - VIEW_Y);

/** The landing-screen thermometer; `progress` (0..1) is how far the liquid has risen. */
export function Thermometer({ progress }: { progress: number }) {
  const level = useSharedValue(0);

  useEffect(() => {
    level.value = withTiming(progress, { duration: 400 });
  }, [progress, level]);

  const liquid = useAnimatedStyle(() => ({
    height: level.value * LIQUID_MAX,
    backgroundColor: interpolateColor(
      level.value,
      [0, 0.5, 1],
      [COLORS.cold, COLORS.mid, COLORS.hot]
    ),
  }));

  return (
    <View style={styles.root}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`${VIEW_X} ${VIEW_Y} ${WIDTH} ${HEIGHT}`}>
        <Path d={SHADOW} stroke="#000" strokeOpacity={0.2} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={OUTLINE} stroke={COLORS.glow} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Ellipse cx={194.5} cy={515} rx={9.5} ry={10} fill={COLORS.blue} />
      </Svg>
      <Animated.View style={[styles.liquid, liquid]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: WIDTH, height: HEIGHT },
  liquid: {
    position: 'absolute',
    left: 194.5 - VIEW_X - LIQUID_WIDTH / 2,
    width: LIQUID_WIDTH,
    bottom: HEIGHT - LIQUID_BOTTOM,
    borderTopLeftRadius: LIQUID_WIDTH / 2,
    borderTopRightRadius: LIQUID_WIDTH / 2,
  },
});
