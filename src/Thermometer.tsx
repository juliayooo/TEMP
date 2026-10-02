import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Rect } from 'react-native-svg';

import { COLORS } from './layout';

const WIDTH = 36;
const HEIGHT = 72;
const SHADOW = '#C3C3C3';
// The liquid rises from the top of the bulb to just under the top of the tube.
const LIQUID_BOTTOM = 46;
const LIQUID_MAX = 38;

function Outline({ color, fill }: { color: string; fill: string }) {
  return (
    <>
      <Rect x={11} y={3} width={15} height={50} rx={7.5} stroke={color} strokeWidth={4} fill={fill} />
      <Circle cx={18.5} cy={55} r={13} stroke={color} strokeWidth={4} fill={fill} />
    </>
  );
}

/** The landing-screen thermometer; `progress` (0..1) is how far the liquid has risen. */
export function Thermometer({ progress }: { progress: number }) {
  const level = useSharedValue(0);

  useEffect(() => {
    level.value = withTiming(progress, { duration: 400 });
  }, [progress, level]);

  const liquid = useAnimatedStyle(() => ({
    height: level.value * LIQUID_MAX,
    backgroundColor: interpolateColor(level.value, [0, 1], [COLORS.cold, COLORS.hot]),
  }));

  return (
    <View style={styles.root}>
      <Svg width={WIDTH} height={HEIGHT}>
        <G x={-3} y={2}>
          <Outline color={SHADOW} fill={SHADOW} />
        </G>
        <Outline color={COLORS.hot} fill={COLORS.background} />
        {/* Open the tube into the bulb. */}
        <Rect x={13} y={38} width={11} height={9} fill={COLORS.background} />
        <Circle cx={18.5} cy={55} r={9} fill={COLORS.cold} />
      </Svg>
      <Animated.View style={[styles.liquid, liquid]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: WIDTH, height: HEIGHT },
  liquid: {
    position: 'absolute',
    left: 15.5,
    width: 6,
    bottom: HEIGHT - LIQUID_BOTTOM - 1,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});
