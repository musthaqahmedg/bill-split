import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// 🎡 Swipe-to-pick number wheel (like the iPhone timer), with a little tick on every number
const ITEM = 40;
const VISIBLE = 3;

export default function NumberWheel({ value, min = 1, max = 10, onChange }) {
  const ref = useRef(null);
  const last = useRef(value);
  const nums = [];
  for (let n = min; n <= Math.max(max, value); n++) nums.push(n);

  // keep the wheel on the right number when it changes from outside
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      ref.current && ref.current.scrollTo({ x: (value - min) * ITEM, animated: true });
    }
  }, [value]);

  const pick = (x) => {
    const n = Math.min(nums[nums.length - 1], Math.max(min, min + Math.round(x / ITEM)));
    if (n !== last.current) {
      last.current = n;
      Haptics.selectionAsync().catch(() => {});
      onChange(n);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.pill} pointerEvents="none" />
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: ITEM * ((VISIBLE - 1) / 2) }}
        contentOffset={{ x: (value - min) * ITEM, y: 0 }}
        scrollEventThrottle={16}
        onScroll={(e) => pick(e.nativeEvent.contentOffset.x)}
      >
        {nums.map((n) => {
          const on = n === value;
          return (
            <TouchableOpacity key={n} style={styles.cell} onPress={() => ref.current && ref.current.scrollTo({ x: (n - min) * ITEM, animated: true })}>
              <Text style={[styles.num, on && styles.numOn]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: ITEM * VISIBLE, height: 36, justifyContent: 'center' },
  pill: { position: 'absolute', left: ITEM, width: ITEM, height: 32, borderRadius: 10, backgroundColor: C.accent },
  cell: { width: ITEM, height: 36, alignItems: 'center', justifyContent: 'center' },
  num: { color: C.faint, fontSize: 15, fontWeight: '600' },
  numOn: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
