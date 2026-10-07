import { Image } from 'expo-image';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { COLORS, formatTemp, layoutChart, type Placed } from './layout';
import type { PhotoPoint } from './photos';

const MAX_SCALE = 6;
const SPOKES = 12; // full diameters, i.e. a line every 15°
// The gradient is drawn small and stretched: a canvas-sized SVG would need a
// bitmap of hundreds of megabytes on a large library.
const GRADIENT_SIZE = 200;
const LINE = 'rgba(255,255,255,0.7)';
// Sampled from design/Mobile - Home NEW.png: a pale hot core, orange, then
// through rust and purple out to lavender.
const GRADIENT: [number, string][] = [
  [0, '#FFE5BF'],
  [0.03, COLORS.hot],
  [0.25, '#FD9624'],
  [0.4, COLORS.warm],
  [0.55, COLORS.mid],
  [0.68, '#A3697D'],
  [0.8, COLORS.cool],
  [0.88, COLORS.cold],
  [0.95, '#8D93E7'],
  [1, COLORS.fade],
];

// Photos are mounted this many screens beyond each edge of the visible area...
const VIEW_MARGIN = 0.6;
// ...and re-chosen while scrolling after travelling this many screens or
// zooming by this factor, and whenever scrolling comes to rest.
const REFRESH_DISTANCE = 0.5;
const REFRESH_ZOOM = 1.5;
// How often the scroll view reports its position to JavaScript, in ms. Panning
// and zooming themselves never wait on these reports.
const SCROLL_REPORT_MS = 100;
// Every photo is drawn from a small copy, requested at 1/LOW_RES_DIVISOR of its
// size and stretched to fit. Once zoomed in past HI_RES_SCALE, photos on the
// screen itself get a full-resolution copy faded in on top.
const LOW_RES_DIVISOR = 4;
const HI_RES_SCALE = 0.9;
// If some photos never report loading, unlock the map anyway.
const READY_TIMEOUT_MS = 5000;
const LABEL_WIDTH = 80;

type Props = {
  photos: PhotoPoint[];
  fahrenheit: boolean;
  onSelect: (photo: PhotoPoint) => void;
};

/** Part of the canvas, centred on (cx, cy) relative to the chart centre, at a zoom scale. */
type Region = { cx: number; cy: number; hw: number; hh: number; scale: number };

const Thumb = memo(function Thumb({
  item,
  half,
  hiRes,
  onLoad,
  onSelect,
}: {
  item: Placed;
  half: number;
  hiRes: boolean;
  onLoad: (id: string) => void;
  onSelect: (photo: PhotoPoint) => void;
}) {
  const { w, h } = item;
  return (
    <Pressable
      onPress={() => onSelect(item.photo)}
      style={{
        position: 'absolute',
        left: half + item.x - w / 2,
        top: half + item.y - h / 2,
        width: w,
        height: h,
      }}>
      {/* The image library sizes its request to the view, so a small view
          scaled up yields a cheap, low-resolution copy. */}
      <Image
        source={{ uri: item.photo.uri }}
        style={{
          position: 'absolute',
          left: (w - w / LOW_RES_DIVISOR) / 2,
          top: (h - h / LOW_RES_DIVISOR) / 2,
          width: w / LOW_RES_DIVISOR,
          height: h / LOW_RES_DIVISOR,
          transform: [{ scale: LOW_RES_DIVISOR }],
        }}
        recyclingKey={`${item.photo.id}-low`}
        cachePolicy="memory"
        priority="low"
        transition={200}
        onLoad={() => onLoad(item.photo.id)}
      />
      {hiRes && (
        <Image
          source={{ uri: item.photo.uri }}
          style={StyleSheet.absoluteFill}
          recyclingKey={item.photo.id}
          cachePolicy="memory"
          transition={150}
        />
      )}
    </Pressable>
  );
});

/**
 * The radial map. Panning, pinch-zooming and momentum are handled natively by
 * the iOS scroll view, so they never wait on JavaScript.
 */
export const RadialMap = memo(function RadialMap({ photos, fahrenheit, onSelect }: Props) {
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const layout = useMemo(() => layoutChart(photos), [photos]);
  const { half, rings } = layout;
  const size = half * 2;
  const fit = Math.min(viewport.width, viewport.height) / size;
  // Open on the hot centre with the rest of the chart running off the screen,
  // so colder photos are found by panning and zooming.
  const home = Math.max(fit, 1);

  const regionAt = useCallback(
    (offsetX: number, offsetY: number, scale: number): Region => ({
      cx: (offsetX + viewport.width / 2) / scale - half,
      cy: (offsetY + viewport.height / 2) / scale - half,
      hw: (viewport.width * (0.5 + VIEW_MARGIN)) / scale,
      hh: (viewport.height * (0.5 + VIEW_MARGIN)) / scale,
      scale,
    }),
    [viewport, half]
  );
  const [shown, setShown] = useState<Region>(() => ({
    cx: 0,
    cy: 0,
    hw: (window.width * (0.5 + VIEW_MARGIN)) / home,
    hh: (window.height * (0.5 + VIEW_MARGIN)) / home,
    scale: home,
  }));

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, zoomScale } = e.nativeEvent;
      const next = regionAt(contentOffset.x, contentOffset.y, zoomScale);
      setShown((prev) => {
        const zoom = next.scale / prev.scale;
        const far =
          Math.abs(next.cx - prev.cx) * next.scale > viewport.width * REFRESH_DISTANCE ||
          Math.abs(next.cy - prev.cy) * next.scale > viewport.height * REFRESH_DISTANCE ||
          zoom > REFRESH_ZOOM ||
          zoom < 1 / REFRESH_ZOOM;
        return far ? next : prev;
      });
    },
    [regionAt, viewport]
  );
  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, zoomScale } = e.nativeEvent;
      setShown(regionAt(contentOffset.x, contentOffset.y, zoomScale));
    },
    [regionAt]
  );

  const visible = useMemo(
    () =>
      layout.items.filter(
        (item) =>
          Math.abs(item.x - shown.cx) < shown.hw + item.w / 2 &&
          Math.abs(item.y - shown.cy) < shown.hh + item.h / 2
      ),
    [layout, shown]
  );
  // Full resolution only for photos actually on screen (not the margin around
  // it), and only when zoomed in far enough for the difference to show.
  const hiRes = useMemo(() => {
    if (shown.scale < HI_RES_SCALE) return new Set<string>();
    const hw = viewport.width / 2 / shown.scale;
    const hh = viewport.height / 2 / shown.scale;
    return new Set(
      visible
        .filter(
          (item) =>
            Math.abs(item.x - shown.cx) < hw + item.w / 2 &&
            Math.abs(item.y - shown.cy) < hh + item.h / 2
        )
        .map((item) => item.photo.id)
    );
  }, [visible, shown, viewport]);

  // The map stays still until the first photos have loaded in.
  const [ready, setReady] = useState(false);
  const [waiting] = useState(() => new Set(visible.map((item) => item.photo.id)));
  const onLoad = useCallback(
    (id: string) => {
      if (waiting.delete(id) && waiting.size === 0) setReady(true);
    },
    [waiting]
  );
  const scroller = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setViewport({ width, height });
      if (timer.current) return;
      // First layout: centre on the hot middle now that the real size is known.
      scroller.current?.scrollTo({
        x: half * home - width / 2,
        y: half * home - height / 2,
        animated: false,
      });
      timer.current = setTimeout(() => setReady(true), waiting.size ? READY_TIMEOUT_MS : 0);
    },
    [waiting, half, home]
  );

  return (
    <View style={styles.viewport}>
      <ScrollView
        ref={scroller}
        style={styles.viewport}
        onLayout={onLayout}
        zoomScale={home}
        minimumZoomScale={fit}
        maximumZoomScale={MAX_SCALE}
        centerContent
        bouncesZoom
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={SCROLL_REPORT_MS}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEnd}
        onMomentumScrollEnd={onScrollEnd}>
        <View style={{ width: size, height: size }}>
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
                  {GRADIENT.map(([offset, color]) => (
                    <Stop key={offset} offset={offset} stopColor={color} />
                  ))}
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
            <Thumb
              key={item.photo.id}
              item={item}
              half={half}
              hiRes={hiRes.has(item.photo.id)}
              onLoad={onLoad}
              onSelect={onSelect}
            />
          ))}

          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {rings.map(({ r, temp }, i) => (
              <Text
                key={`label-${i}`}
                style={[styles.label, { left: half - LABEL_WIDTH / 2, top: half + r - 21 }]}>
                {formatTemp(temp, fahrenheit)}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
      {/* Swallows touches until the map is ready, without disabling the scroll
        view itself (which would also block centring it from code). */}
      {!ready && <View style={StyleSheet.absoluteFill} />}
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: COLORS.fade },
  spoke: { position: 'absolute', left: 0, height: 1, backgroundColor: LINE },
  ring: { position: 'absolute', borderWidth: 1, borderColor: LINE },
  label: {
    position: 'absolute',
    width: LABEL_WIDTH,
    textAlign: 'center',
    color: '#fff',
    fontSize: 15,
    fontWeight: '300',
  },
});
