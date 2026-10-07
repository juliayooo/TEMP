import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { Logo } from './src/Logo';
import {
  loadPhotos,
  MAX_PHOTOS,
  type PhotoPoint,
  type Progress,
  requestAccess,
} from './src/photos';
import { RadialMap } from './src/RadialMap';
import { RowsView } from './src/RowsView';
import { Thermometer } from './src/Thermometer';

// Two rows of toggles beside the logo, plus padding.
const FOOTER_HEIGHT = 92;

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
    if (!(await requestAccess())) {
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
        <Logo width={279} />
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

  return (
    <View style={styles.root}>
      {photos.length === 0 && (
        <Text style={[styles.caption, styles.empty, { top: insets.top + 24 }]}>
          No photos with a location found
        </Text>
      )}

      {/* Both views stay mounted so switching between them doesn't reload any photos. */}
      <View style={view === 'map' ? styles.pane : styles.hidden}>
        <RadialMap photos={photos} fahrenheit={fahrenheit} onSelect={setSelected} />
      </View>
      {rowsOpened && (
        <View style={view === 'rows' ? styles.pane : styles.hidden}>
          <RowsView
            photos={photos}
            fahrenheit={fahrenheit}
            topInset={insets.top}
            onSelect={setSelected}
          />
        </View>
      )}

      {/* Both views end above this band rather than running underneath it. */}
      <View style={[styles.footer, { height: insets.bottom + FOOTER_HEIGHT, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.toggles}>
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
          <View style={styles.units}>
            <Pressable hitSlop={12} onPress={() => setFahrenheit(true)}>
              <Text style={[styles.unit, fahrenheit && styles.unitActive]}>F</Text>
            </Pressable>
            <View style={styles.unitDivider} />
            <Pressable hitSlop={12} onPress={() => setFahrenheit(false)}>
              <Text style={[styles.unit, !fahrenheit && styles.unitActive]}>C</Text>
            </Pressable>
          </View>
        </View>
        <Logo width={170} variant="white" />
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
  caption: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 40,
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  empty: { position: 'absolute', left: 0, right: 0, zIndex: 2 },
  footer: {
    backgroundColor: COLORS.cold,
    paddingLeft: 32,
    paddingRight: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  toggles: { gap: 14, paddingBottom: 6 },
  units: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unit: { color: '#fff', fontSize: 13, fontWeight: '700' },
  unitActive: { color: COLORS.active },
  unitDivider: { width: 1, height: 20, backgroundColor: '#fff' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  preview: { width: '100%', height: '60%', marginBottom: 12 },
  detailTemp: { fontSize: 56, fontWeight: '200' },
});
