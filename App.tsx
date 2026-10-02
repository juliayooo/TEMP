import { Image } from 'expo-image';
import { requestPermissionsAsync } from 'expo-media-library';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatTemp, tempColor } from './src/layout';
import { loadPhotos, MAX_PHOTOS, type PhotoPoint, type Progress } from './src/photos';
import { RadialMap } from './src/RadialMap';

type Phase = 'intro' | 'denied' | 'loading' | 'done';

function Screen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('intro');
  const [photos, setPhotos] = useState<PhotoPoint[]>([]);
  const [progress, setProgress] = useState<Progress>({ scanned: 0, noLocation: 0, noWeather: 0 });
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
        () => cancelled.current
      );
    } finally {
      setPhase('done');
    }
  }, []);

  const sorted = useMemo(() => [...photos].sort((a, b) => b.temp - a.temp), [photos]);
  const max = sorted[0]?.temp ?? 0;
  const min = sorted[sorted.length - 1]?.temp ?? 0;

  if (phase === 'intro' || phase === 'denied') {
    return (
      <View style={[styles.root, styles.centred]}>
        <Text style={styles.title}>Your photos, by temperature</Text>
        <Text style={styles.body}>
          {phase === 'intro'
            ? 'Every photo with a location is placed on a radial map: the hottest moments at the centre, the coldest at the edge.'
            : 'Photo access was denied. Allow access to your photos in Settings to build the map.'}
        </Text>
        <Pressable
          style={styles.button}
          onPress={phase === 'intro' ? start : () => Linking.openSettings()}>
          <Text style={styles.buttonText}>
            {phase === 'intro' ? 'Allow photo access' : 'Open Settings'}
          </Text>
        </Pressable>
        {phase === 'denied' && (
          <Pressable onPress={start}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {sorted.length > 0 ? (
        <RadialMap photos={sorted} min={min} max={max} onSelect={setSelected} />
      ) : (
        <View style={styles.centred}>
          {phase === 'loading' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.body}>
              No photos with location data were found, or the weather service could not be reached.
            </Text>
          )}
        </View>
      )}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View>
          <Text style={styles.count}>{sorted.length} photos</Text>
          <Text style={styles.status}>
            {phase === 'loading'
              ? `Scanning… ${progress.scanned} checked`
              : `${progress.noLocation} without location` +
                (progress.noWeather ? ` · ${progress.noWeather} without weather` : '') +
                (sorted.length >= MAX_PHOTOS ? ` · newest ${MAX_PHOTOS} shown` : '')}
          </Text>
        </View>
        <Pressable style={styles.unit} onPress={() => setFahrenheit((f) => !f)}>
          <Text style={styles.unitText}>{fahrenheit ? '°F' : '°C'}</Text>
        </Pressable>
      </View>

      {sorted.length > 0 && (
        <View style={[styles.legend, { paddingBottom: insets.bottom + 12 }]} pointerEvents="none">
          <Text style={styles.legendText}>Edge {formatTemp(min, fahrenheit)}</Text>
          <View style={styles.legendBar}>
            {Array.from({ length: 24 }, (_, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: tempColor(i / 23) }} />
            ))}
          </View>
          <Text style={styles.legendText}>Centre {formatTemp(max, fahrenheit)}</Text>
        </View>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {selected && (
            <>
              <Image source={{ uri: selected.uri }} style={styles.preview} contentFit="contain" />
              <Text
                style={[
                  styles.detailTemp,
                  { color: tempColor((selected.temp - min) / (max - min || 1)) },
                ]}>
                {formatTemp(selected.temp, fahrenheit)}
              </Text>
              <Text style={styles.body}>
                {new Date(selected.time).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
              <Text style={styles.status}>
                {selected.latitude.toFixed(3)}, {selected.longitude.toFixed(3)}
              </Text>
            </>
          )}
        </Pressable>
      </Modal>
      <StatusBar style="light" />
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
  root: { flex: 1, backgroundColor: '#0b0b10' },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  body: { color: '#c9c9d4', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  button: { backgroundColor: '#f79d3c', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28 },
  buttonText: { color: '#0b0b10', fontSize: 16, fontWeight: '700' },
  link: { color: '#c9c9d4', fontSize: 15, textDecorationLine: 'underline' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  count: { color: '#fff', fontSize: 20, fontWeight: '700' },
  status: { color: '#9a9aa8', fontSize: 13, marginTop: 2 },
  unit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1d1d27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  legend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  legendText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,5,8,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  preview: { width: '100%', height: '60%', marginBottom: 12 },
  detailTemp: { fontSize: 44, fontWeight: '800' },
});
