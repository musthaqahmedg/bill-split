import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

const EMOJI = { food: '🍽️', alcohol: '🍸', soft: '🥤' };
const inr = (n) => 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

// "🔥 Popular here": the most ordered items at a place, from bills our users scanned there.
// One item at a time, sliding and fading in like a showcase.
export default function PopularHere({ place, quietIfEmpty = false }) {
  const [items, setItems] = useState(null); // null = loading
  const [i, setI] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    setItems(null);
    setI(0);
    // Wait until typing stops before looking it up
    const t = setTimeout(() => {
      supabase
        .rpc('popular_items', { p_place: place })
        .then(({ data }) => alive && setItems(data || []))
        .catch(() => alive && setItems([]));
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [place]);

  // Next item every 2.8 seconds
  useEffect(() => {
    if (!items || items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 2800);
    return () => clearInterval(t);
  }, [items]);

  // Animate each new item in
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [i, items]);

  if (!place || /^my place|current location/i.test(place.trim())) return null;

  if (items === null) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={C.accentSoft} />
      </View>
    );
  }

  if (items.length === 0) {
    if (quietIfEmpty) return null;
    return (
      <View style={[styles.box, styles.empty]}>
        <Text style={styles.emptyTitle}>🔓 No menu here yet</Text>
        <Text style={styles.emptySub}>Scan a bill at this place and its popular dishes show up here for everyone.</Text>
      </View>
    );
  }

  const it = items[i];
  const move = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };

  return (
    <View style={styles.box}>
      <Text style={styles.kicker}>🔥 POPULAR HERE</Text>
      <Animated.View style={move}>
        <Text style={styles.emoji}>{EMOJI[it.kind] || '🍽️'}</Text>
        <Text style={styles.name} numberOfLines={2}>{it.name}</Text>
        {it.about ? <Text style={styles.about} numberOfLines={2}>{it.about}</Text> : null}
        <View style={styles.row}>
          <Text style={styles.price}>{inr(it.price)} <Text style={styles.each}>each</Text></Text>
          <Text style={styles.orders}>Ordered {it.orders}×</Text>
        </View>
      </Animated.View>
      <View style={styles.dots}>
        {items.map((_, k) => (
          <View key={k} style={[styles.dot, k === i && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.source}>Price per item on real bills here, before tax · from bills scanned on Vibe Out</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.cardHi, borderRadius: 18, padding: 18, marginBottom: 16, alignItems: 'center', overflow: 'hidden' },
  kicker: { color: C.pink, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  emoji: { fontSize: 40, textAlign: 'center' },
  name: { color: C.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  about: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  price: { color: C.green, fontSize: 18, fontWeight: '800', marginRight: 12 },
  each: { color: C.sub, fontSize: 13, fontWeight: '600' },
  orders: { color: C.faint, fontSize: 13 },
  dots: { flexDirection: 'row', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border, marginHorizontal: 3 },
  dotOn: { backgroundColor: C.accentSoft, width: 16 },
  source: { color: C.faint, fontSize: 11, marginTop: 10, textAlign: 'center' },
  empty: { alignItems: 'flex-start' },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  emptySub: { color: C.sub, fontSize: 13, marginTop: 4 },
});
