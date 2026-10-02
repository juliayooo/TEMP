import { Image } from 'expo-image';
import { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { mapRadius, spiralPosition, tempColor, THUMB } from './layout';
import type { PhotoPoint } from './photos';

const GRADIENT_STOPS = 12;
const MAX_SCALE = 4;

type Props = {
  /** Sorted hottest first. */
  photos: PhotoPoint[];
  min: number;
  max: number;
  onSelect: (photo: PhotoPoint) => void;
};

const Thumb = memo(function Thumb({
  photo,
  index,
  centre,
  color,
  onSelect,
}: {
  photo: PhotoPoint;
  index: number;
  centre: number;
  color: string;
  onSelect: (photo: PhotoPoint) => void;
}) {
  const { x, y } = spiralPosition(index);
  return (
    <Pressable
      onPress={() => onSelect(photo)}
      style={[
        styles.thumb,
        { left: centre + x - THUMB / 2, top: centre + y - THUMB / 2, borderColor: color },
      ]}>
      <Image source={{ uri: photo.uri }} style={styles.image} recyclingKey={photo.id} />
    </Pressable>
  );
});

export function RadialMap({ photos, min, max, onSelect }: Props) {
  const window = useWindowDimensions();
  const radius = mapRadius(photos.length);
  const size = radius * 2;
  const fit = Math.min(1, window.width / size);
  const span = max - min || 1;

  const scale = useSharedValue(fit);
  const startScale = useSharedValue(fit);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Keep the whole map in view while photos are still streaming in.
  useEffect(() => {
    scale.value = withTiming(fit);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
  }, [fit, scale, tx, ty]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .onStart(() => {
        startX.value = tx.value;
        startY.value = ty.value;
      })
      .onUpdate((e) => {
        tx.value = startX.value + e.translationX;
        ty.value = startY.value + e.translationY;
      });
    const pinch = Gesture.Pinch()
      .onStart(() => {
        startScale.value = scale.value;
      })
      .onUpdate((e) => {
        const next = Math.min(MAX_SCALE, Math.max(fit * 0.8, startScale.value * e.scale));
        // Zoom about the map centre, keeping the panned offset proportional.
        tx.value = (tx.value / scale.value) * next;
        ty.value = (ty.value / scale.value) * next;
        scale.value = next;
      });
    const reset = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        scale.value = withTiming(fit);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
      });
    return Gesture.Simultaneous(pan, pinch, reset);
  }, [fit, scale, startScale, tx, ty, startX, startY]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // The gradient is sampled from the photos themselves: the colour at a given
  // radius is the temperature of the photo sitting at that radius.
  const stops = useMemo(
    () =>
      Array.from({ length: GRADIENT_STOPS }, (_, k) => {
        const f = k / (GRADIENT_STOPS - 1);
        const photo = photos[Math.min(photos.length - 1, Math.floor(f * f * photos.length))];
        return { offset: f, color: tempColor((photo.temp - min) / span) };
      }),
    [photos, min, span]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.viewport}>
        <Animated.View style={[{ width: size, height: size }, animated]}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="heat" cx="50%" cy="50%" r="50%">
                {stops.map((s) => (
                  <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={0.85} />
                ))}
              </RadialGradient>
            </Defs>
            <Circle cx={radius} cy={radius} r={radius} fill="url(#heat)" />
          </Svg>
          {photos.map((photo, i) => (
            <Thumb
              key={photo.id}
              photo={photo}
              index={i}
              centre={radius}
              color={tempColor((photo.temp - min) / span)}
              onSelect={onSelect}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#0b0b10',
  },
  image: { flex: 1 },
});
