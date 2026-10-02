import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { COLORS, formatTemp, layoutChart, type Placed } from './layout';
import type { PhotoPoint } from './photos';

const MAX_SCALE = 6;
const SPOKES = 12; // full diameters, i.e. a line every 15°
// The gradient is drawn small and stretched: a canvas-sized SVG would need a
// bitmap of hundreds of megabytes on a large library.
const GRADIENT_SIZE = 200;
const LINE = 'rgba(255,255,255,0.7)';
// Photos are mounted this many screens beyond each edge of the visible area...
const VIEW_MARGIN = 0.75;
// ...and the mounted set is refreshed after travelling this many screens.
const REFRESH_DISTANCE = 0.4;

type Props = {
  photos: PhotoPoint[];
  fahrenheit: boolean;
  onSelect: (photo: PhotoPoint) => void;
};

const Thumb = memo(function Thumb({
  item,
  half,
  onSelect,
}: {
  item: Placed;
  half: number;
  onSelect: (photo: PhotoPoint) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.photo)}
      style={{
        position: 'absolute',
        left: half + item.x - item.w / 2,
        top: half + item.y - item.h / 2,
        width: item.w,
        height: item.h,
      }}>
      <Image
        source={{ uri: item.photo.uri }}
        style={styles.image}
        recyclingKey={item.photo.id}
        cachePolicy="memory"
        priority="low"
      />
    </Pressable>
  );
});

export function RadialMap({ photos, fahrenheit, onSelect }: Props) {
  const window = useWindowDimensions();
  const layout = useMemo(() => layoutChart(photos), [photos]);
  const { half, rings } = layout;
  const size = half * 2;
  const fit = window.width / size;
  // Open on the hot centre with the rest of the chart running off the screen,
  // so colder photos are found by panning and zooming.
  const home = Math.max(fit, 1);

  const scale = useSharedValue(home);
  const startScale = useSharedValue(home);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Only photos on or near the screen are mounted, so a few dozen images load
  // at a time instead of the whole library. `shown` is the region (in canvas
  // coordinates relative to the centre) that was last mounted, and the `shown*`
  // shared values are the transform it was computed for.
  const regionFor = useCallback(
    (x: number, y: number, s: number) => ({
      cx: -x / s,
      cy: -y / s,
      hw: (window.width * (0.5 + VIEW_MARGIN)) / s,
      hh: (window.height * (0.5 + VIEW_MARGIN)) / s,
    }),
    [window.width, window.height]
  );
  const [shown, setShown] = useState(() => regionFor(0, 0, home));
  const shownX = useSharedValue(0);
  const shownY = useSharedValue(0);
  const shownScale = useSharedValue(home);
  const show = useCallback(
    (x: number, y: number, s: number) => setShown(regionFor(x, y, s)),
    [regionFor]
  );

  // Frame the hot centre whenever the chart changes size.
  useEffect(() => {
    scale.value = withTiming(home);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    shownX.value = 0;
    shownY.value = 0;
    shownScale.value = home;
    show(0, 0, home);
  }, [home, scale, tx, ty, shownX, shownY, shownScale, show]);

  const gesture = useMemo(() => {
    const { width, height } = window;
    // Re-mount photos once the view has moved or zoomed well away from `shown`.
    const refresh = () => {
      'worklet';
      const zoom = scale.value / shownScale.value;
      if (
        Math.abs(tx.value - shownX.value) > width * REFRESH_DISTANCE ||
        Math.abs(ty.value - shownY.value) > height * REFRESH_DISTANCE ||
        zoom > 1.25 ||
        zoom < 0.8
      ) {
        shownX.value = tx.value;
        shownY.value = ty.value;
        shownScale.value = scale.value;
        scheduleOnRN(show, tx.value, ty.value, scale.value);
      }
    };
    const pan = Gesture.Pan()
      .onStart(() => {
        startX.value = tx.value;
        startY.value = ty.value;
      })
      .onUpdate((e) => {
        tx.value = startX.value + e.translationX;
        ty.value = startY.value + e.translationY;
        refresh();
      });
    const pinch = Gesture.Pinch()
      .onStart(() => {
        startScale.value = scale.value;
      })
      .onUpdate((e) => {
        const next = Math.min(MAX_SCALE, Math.max(fit * 0.9, startScale.value * e.scale));
        // Zoom about the chart centre, keeping the panned offset proportional.
        tx.value = (tx.value / scale.value) * next;
        ty.value = (ty.value / scale.value) * next;
        scale.value = next;
        refresh();
      });
    const reset = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        scale.value = withTiming(home);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        shownX.value = 0;
        shownY.value = 0;
        shownScale.value = home;
        scheduleOnRN(show, 0, 0, home);
      });
    return Gesture.Simultaneous(pan, pinch, reset);
  }, [fit, home, window, scale, startScale, tx, ty, startX, startY, shownX, shownY, shownScale, show]);

  const visible = useMemo(
    () =>
      layout.items.filter(
        (item) =>
          Math.abs(item.x - shown.cx) < shown.hw + item.w / 2 &&
          Math.abs(item.y - shown.cy) < shown.hh + item.h / 2
      ),
    [layout, shown]
  );

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.viewport}>
        <Animated.View style={[{ width: size, height: size }, animated]}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: half - GRADIENT_SIZE / 2,
              top: half - GRADIENT_SIZE / 2,
              transform: [{ scale: size / GRADIENT_SIZE }],
            }}>
            <Svg width={GRADIENT_SIZE} height={GRADIENT_SIZE}>
              <Defs>
                <RadialGradient id="heat" cx="50%" cy="50%" r="50%">
                  <Stop offset={0} stopColor={COLORS.hot} />
                  <Stop offset={0.4} stopColor={COLORS.mid} />
                  <Stop offset={0.75} stopColor={COLORS.cold} />
                  <Stop offset={1} stopColor={COLORS.fade} />
                </RadialGradient>
              </Defs>
              <Rect width={GRADIENT_SIZE} height={GRADIENT_SIZE} fill="url(#heat)" />
            </Svg>
          </View>

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {Array.from({ length: SPOKES }, (_, i) => (
              <View
                key={`spoke-${i}`}
                style={[
                  styles.spoke,
                  { top: half, width: size, transform: [{ rotate: `${(i * 180) / SPOKES}deg` }] },
                ]}
              />
            ))}
            {rings.map(({ r }, i) => (
              <View
                key={`ring-${i}`}
                style={[
                  styles.ring,
                  { left: half - r, top: half - r, width: r * 2, height: r * 2, borderRadius: r },
                ]}
              />
            ))}
          </View>

          {visible.map((item) => (
            <Thumb key={item.photo.id} item={item} half={half} onSelect={onSelect} />
          ))}

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {rings.map(({ r, temp }, i) => (
              <Text key={`label-${i}`} style={[styles.label, { top: half + r - 22, width: size }]}>
                {formatTemp(temp, fahrenheit)}
              </Text>
            ))}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.fade,
  },
  image: { flex: 1 },
  spoke: { position: 'absolute', left: 0, height: 1, backgroundColor: LINE },
  ring: { position: 'absolute', borderWidth: 1, borderColor: LINE },
  label: {
    position: 'absolute',
    left: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
