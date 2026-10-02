import { Image } from 'expo-image';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { tempColor } from './layout';
import type { PhotoPoint } from './photos';

const PHOTO_HEIGHT = 96;
const LINE = 'rgba(255,255,255,0.7)';

type Props = {
  photos: PhotoPoint[];
  fahrenheit: boolean;
  /** Space to leave under the last row for the floating controls. */
  bottomInset: number;
  onSelect: (photo: PhotoPoint) => void;
};

type Row = { degrees: number; color: string; photos: PhotoPoint[] };

/** One horizontally scrolling row of photos per whole degree, hottest row first. */
export function RowsView({ photos, fahrenheit, bottomInset, onSelect }: Props) {
  const rows = useMemo(() => {
    const byDegree = new Map<number, PhotoPoint[]>();
    for (const photo of photos) {
      const degrees = Math.round(fahrenheit ? photo.temp * 1.8 + 32 : photo.temp);
      const row = byDegree.get(degrees);
      if (row) row.push(photo);
      else byDegree.set(degrees, [photo]);
    }
    const sorted = [...byDegree.keys()].sort((a, b) => b - a);
    const span = sorted[0] - sorted[sorted.length - 1] || 1;
    return sorted.map<Row>((degrees) => ({
      degrees,
      color: tempColor((degrees - sorted[sorted.length - 1]) / span),
      // Newest first within a row.
      photos: byDegree.get(degrees)!.sort((a, b) => b.time - a.time),
    }));
  }, [photos, fahrenheit]);

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(row) => String(row.degrees)}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      renderItem={({ item: row }) => (
        <View style={[styles.row, { backgroundColor: row.color }]}>
          <View style={styles.labelColumn}>
            <Text style={styles.label}>{row.degrees}°</Text>
            <Text style={styles.count}>{row.photos.length}</Text>
          </View>
          <FlatList
            horizontal
            data={row.photos}
            keyExtractor={(photo) => photo.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photos}
            initialNumToRender={5}
            renderItem={({ item: photo }) => (
              <Pressable onPress={() => onSelect(photo)}>
                <Image
                  source={{ uri: photo.uri }}
                  recyclingKey={photo.id}
                  cachePolicy="memory"
                  priority="low"
                  style={{
                    height: PHOTO_HEIGHT,
                    width: PHOTO_HEIGHT * Math.min(1.4, Math.max(0.7, photo.aspect)),
                  }}
                />
              </Pressable>
            )}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  labelColumn: { width: 64, alignItems: 'center', gap: 2 },
  label: { color: '#fff', fontSize: 16, fontWeight: '700' },
  count: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  photos: { gap: 6, paddingVertical: 12, paddingRight: 16 },
});
