import { Image } from 'expo-image';
import { requestPermissionsAsync } from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image as StaticImage,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, formatTemp, tempColor } from './src/layout';
import { loadPhotos, MAX_PHOTOS, type PhotoPoint, type Progress } from './src/photos';
import { RadialMap } from './src/RadialMap';
import { RowsView } from './src/RowsView';
import { Thermometer } from './src/Thermometer';

const LANDING_LOGO = require('./assets/logo-landing.png');
const HEADER_LOGO = require('./assets/logo-header.png');

type Phase = 'intro' | 'denied' | 'loading' | 'done';

function Screen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('intro');
  const [photos, setPhotos] = useState<PhotoPoint[]>([]);
  const [progress, setProgress] = useState<Progress>({ scanned: 0, noLocation: 0, noWeather: 0 });
  const [placed, setPlaced] = useState(0);
  const [view, setView] = useState<'map' | 'rows'>('map');
  // The rows are built the first time they are opened, then kept alive.
  const [rowsOpened, setRowsOpened] = useState(false);
  const [fahrenheit, setFahrenheit] = useState(false);
  const [selected, setSelected] = useState<PhotoPoint | null>(null);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    []
  );

  const start = useCallback(async () => {
    const permission = await requestPermissionsAsync();
    if (!permission.granted) {
      setPhase('denied');
      return;
    }
    setPhase('loading');
    try {
      await loadPhotos(
        (next, nextProgress) => {
          setPhotos(next);
          setProgress(nextProgress);
        },
        () => cancelled.current,
        setPlaced
      );
    } finally {
      // Let the thermometer finish filling before the map appears.
      setPlaced(MAX_PHOTOS);
      setTimeout(() => setPhase('done'), 600);
    }
  }, []);

  const [min, max] = useMemo(() => {
    const temps = photos.map((p) => p.temp);
    return [Math.min(...temps), Math.max(...temps)];
  }, [photos]);

  if (phase !== 'done') {
    return (
      <Pressable
        style={[styles.root, styles.centred]}
        disabled={phase === 'loading'}
        onPress={phase === 'intro' ? start : () => Linking.openSettings()}>
        <StaticImage source={LANDING_LOGO} style={styles.landingLogo} />
        {/* Warm the cache so the header logo is there the moment the map appears. */}
        <StaticImage source={HEADER_LOGO} style={styles.preload} />
        <Thermometer progress={placed / MAX_PHOTOS} />
        <Text style={styles.caption}>
          {phase === 'intro'
            ? 'Tap to allow photo access'
            : phase === 'denied'
              ? 'Photo access denied\nTap to open Settings'
              : `Reading your photos\n${progress.scanned} checked · ${placed} placed`}
        </Text>
        <StatusBar style="dark" />
      </Pressable>
    );
  }

  const status =
    photos.length === 0
      ? 'No photos with a location found'
      : `${photos.length} photos` + (photos.length >= MAX_PHOTOS ? ' (newest)' : '');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <StaticImage source={HEADER_LOGO} style={styles.headerLogo} fadeDuration={0} />
        <View style={styles.nav}>
          <Text style={styles.navItem}>Weather</Text>
          <Text style={styles.navCount}>{status}</Text>
        </View>
      </View>

      {/* Both views stay mounted so switching between them doesn't reload any photos. */}
      <View style={view === 'map' ? styles.pane : styles.hidden}>
        <RadialMap photos={photos} fahrenheit={fahrenheit} onSelect={setSelected} />
      </View>
      {rowsOpened && (
        <View style={view === 'rows' ? styles.pane : styles.hidden}>
          <RowsView
            photos={photos}
            fahrenheit={fahrenheit}
            bottomInset={insets.bottom + 64}
            onSelect={setSelected}
          />
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <View style={styles.units}>
          <Pressable hitSlop={12} onPress={() => setFahrenheit(true)}>
            <Text style={[styles.unit, fahrenheit && styles.unitActive]}>F</Text>
          </Pressable>
          <View style={styles.unitDivider} />
          <Pressable hitSlop={12} onPress={() => setFahrenheit(false)}>
            <Text style={[styles.unit, !fahrenheit && styles.unitActive]}>C</Text>
          </Pressable>
        </View>
        <View style={styles.units}>
          <Pressable hitSlop={12} onPress={() => setView('map')}>
            <Text style={[styles.unit, view === 'map' && styles.unitActive]}>MAP</Text>
          </Pressable>
          <View style={styles.unitDivider} />
          <Pressable
            hitSlop={12}
            onPress={() => {
              setRowsOpened(true);
              setView('rows');
            }}>
            <Text style={[styles.unit, view === 'rows' && styles.unitActive]}>ROWS</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {selected && (
            <>
              <Image
                source={{ uri: selected.uri }}
                style={styles.preview}
                contentFit="contain"
                priority="high"
              />
              <Text
                style={[
                  styles.detailTemp,
                  { color: tempColor((selected.temp - min) / (max - min || 1)) },
                ]}>
                {formatTemp(selected.temp, fahrenheit)}
              </Text>
              <Text style={styles.caption}>
                {new Date(selected.time).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {'\n'}
                {selected.latitude.toFixed(3)}, {selected.longitude.toFixed(3)}
              </Text>
            </>
          )}
        </Pressable>
      </Modal>
      <StatusBar style="dark" />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Screen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  pane: { flex: 1 },
  hidden: { display: 'none' },
  centred: { alignItems: 'center', justifyContent: 'center', gap: 18 },
  landingLogo: { width: 274, height: 122 },
  caption: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 40,
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  header: {
    backgroundColor: COLORS.background,
    paddingLeft: 13,
    paddingRight: 32,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  headerLogo: { width: 182, height: 81 },
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  nav: { alignItems: 'flex-end', gap: 8 },
  navItem: { color: COLORS.text, fontSize: 13, letterSpacing: 0.3, textTransform: 'uppercase' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  units: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unit: { color: '#fff', fontSize: 13, fontWeight: '700' },
  unitActive: { color: COLORS.active },
  unitDivider: { width: 1, height: 20, backgroundColor: '#fff' },
  navCount: { color: COLORS.text, fontSize: 11, letterSpacing: 0.3, opacity: 0.7, textTransform: 'uppercase' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(244,244,244,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  preview: { width: '100%', height: '60%', marginBottom: 12 },
  detailTemp: { fontSize: 48, fontWeight: '800' },
});
