import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, type ListRenderItem, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, formatTemp, tempColor } from './layout';
import type { PhotoPoint } from './photos';

const PHOTO_HEIGHT = 96;
const ROW_PADDING = 12;
const ROW_HEIGHT = PHOTO_HEIGHT + ROW_PADDING * 2;

type Props = {
  photos: PhotoPoint[];
  fahrenheit: boolean;
  /** Space above the first row, for the status bar. */
  topInset: number;
  onSelect: (photo: PhotoPoint) => void;
};

/** `top` and `bottom` are the row's edge colours, blended halfway into its neighbours. */
type Row = { celsius: number; top: string; bottom: string; photos: PhotoPoint[] };

const RowPhoto = memo(function RowPhoto({
  photo,
  onSelect,
}: {
  photo: PhotoPoint;
  onSelect: (photo: PhotoPoint) => void;
}) {
  return (
    <Pressable onPress={() => onSelect(photo)}>
      <Image
        source={{ uri: photo.uri }}
        recyclingKey={photo.id}
        cachePolicy="memory"
        priority="low"
        transition={150}
        style={{
          height: PHOTO_HEIGHT,
          width: PHOTO_HEIGHT * Math.min(1.4, Math.max(0.7, photo.aspect)),
        }}
      />
    </Pressable>
  );
});

/** A row's photos, kept separate from its label so a unit change re-renders only the label. */
const RowPhotos = memo(function RowPhotos({
  photos,
  onSelect,
}: {
  photos: PhotoPoint[];
  onSelect: (photo: PhotoPoint) => void;
}) {
  const renderItem = useCallback<ListRenderItem<PhotoPoint>>(
    ({ item }) => <RowPhoto photo={item} onSelect={onSelect} />,
    [onSelect]
  );
  return (
    <FlatList
      horizontal
      data={photos}
      keyExtractor={(photo) => photo.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.photos}
      initialNumToRender={5}
      renderItem={renderItem}
    />
  );
});

const RowItem = memo(function RowItem({
  row,
  fahrenheit,
  onSelect,
}: {
  row: Row;
  fahrenheit: boolean;
  onSelect: (photo: PhotoPoint) => void;
}) {
  return (
    <LinearGradient colors={[row.top, row.bottom]} style={styles.row}>
      <View style={styles.labelColumn}>
        <Text style={styles.label}>{formatTemp(row.celsius, fahrenheit)}</Text>
      </View>
      <RowPhotos photos={row.photos} onSelect={onSelect} />
    </LinearGradient>
  );
});

/**
 * One horizontally scrolling row of photos per whole °C, hottest first, over
 * one continuous gradient from orange down to purple. Rows are always grouped
 * in °C so switching units only relabels them.
 */
export const RowsView = memo(function RowsView({ photos, fahrenheit, topInset, onSelect }: Props) {
  const rows = useMemo(() => {
    const byDegree = new Map<number, PhotoPoint[]>();
    for (const photo of photos) {
      const celsius = Math.round(photo.temp);
      const row = byDegree.get(celsius);
      if (row) row.push(photo);
      else byDegree.set(celsius, [photo]);
    }
    const sorted = [...byDegree.keys()].sort((a, b) => b - a);
    const min = sorted[sorted.length - 1];
    const span = sorted[0] - min || 1;
    const t = sorted.map((celsius) => (celsius - min) / span);
    return sorted.map<Row>((celsius, i) => ({
      celsius,
      top: tempColor(i === 0 ? t[i] : (t[i - 1] + t[i]) / 2),
      bottom: tempColor(i === sorted.length - 1 ? t[i] : (t[i] + t[i + 1]) / 2),
      // Newest first within a row.
      photos: byDegree.get(celsius)!.sort((a, b) => b.time - a.time),
    }));
  }, [photos]);

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item }) => <RowItem row={item} fahrenheit={fahrenheit} onSelect={onSelect} />,
    [fahrenheit, onSelect]
  );

  const first = rows[0]?.top ?? COLORS.hot;
  const last = rows[rows.length - 1]?.bottom ?? COLORS.cold;

  return (
    <View style={styles.root}>
      {/* Shows when the list is pulled past either end, matching the end rows. */}
      <LinearGradient
        colors={[first, first, last, last]}
        locations={[0, 0.5, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => String(row.celsius)}
        // Every row is the same height, so the list never has to measure them.
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: topInset + ROW_HEIGHT * index,
          index,
        })}
        extraData={fahrenheit}
        ListHeaderComponent={<View style={{ height: topInset, backgroundColor: first }} />}
        renderItem={renderItem}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT },
  labelColumn: { width: 64, alignItems: 'center' },
  label: { color: '#fff', fontSize: 18, fontWeight: '300' },
  photos: { gap: 6, paddingVertical: ROW_PADDING, paddingRight: 16 },
});
