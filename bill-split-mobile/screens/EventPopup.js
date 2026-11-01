import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { eventKm, eventWhen } from '../services/events';
import { C, F } from '../services/theme';

// 🎉 Big event pop-up: poster card, venue + distance + "From ₹X", Book now, swipe for more, Remind me later
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

function Poster({ uri }) {
  const [loaded, setLoaded] = useState(false);
  const glow = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: true }), Animated.timing(glow, { toValue: 0.4, duration: 600, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <View style={styles.poster}>
      {!loaded ? (
        <Animated.View style={[styles.skeleton, { opacity: glow }]}>
          <Text style={styles.skelText}>{uri ? 'LOADING…' : '🎉'}</Text>
        </Animated.View>
      ) : null}
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoad={() => setLoaded(true)} /> : null}
    </View>
  );
}

export default function EventPopup({ visible, events, start = 0, onClose, onRemind, onPlanEvent }) {
  const { width } = Dimensions.get('window');
  const cardW = Math.min(width - 48, 360);
  const [page, setPage] = useState(start);
  const [booked, setBooked] = useState(null); // event they tapped Book on → offer a party room

  const book = (e) => {
    if (e.status === 'sold_out') return;
    if (e.booking_url) Linking.openURL(e.booking_url).catch(() => {});
    setBooked(e);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dim}>
        {booked ? (
          <View style={[styles.card, { width: cardW, padding: 20 }]}>
            <Text style={styles.kicker}>YOU'RE GOING? 🤟</Text>
            <Text style={styles.title}>{booked.title}</Text>
            <Text style={styles.meta}>{eventWhen(booked)} · {booked.venue_name}</Text>
            <Text style={styles.lead}>Make a party room so friends can join, plan and split the costs.</Text>
            <TouchableOpacity style={styles.book} onPress={() => { const e = booked; setBooked(null); onPlanEvent(e); }} activeOpacity={0.85}>
              <Text style={styles.bookText}>CREATE PARTY ROOM →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setBooked(null); onClose(); }} hitSlop={8}>
              <Text style={styles.later}>Not now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList
              data={events}
              horizontal
              pagingEnabled
              snapToInterval={width}
              initialScrollIndex={Math.min(start, Math.max(0, events.length - 1))}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(e) => e.id}
              onMomentumScrollEnd={(ev) => setPage(Math.round(ev.nativeEvent.contentOffset.x / width))}
              renderItem={({ item: e }) => {
                const sold = e.status === 'sold_out';
                return (
                  <View style={{ width, alignItems: 'center' }}>
                    <View style={[styles.card, { width: cardW }]}>
                      <Poster uri={e.poster_url} />
                      <View style={styles.body}>
                        <View style={styles.row}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.venue} numberOfLines={1}>{e.venue_name.toUpperCase()}</Text>
                            <Text style={styles.meta} numberOfLines={1}>{[eventKm(e.km), eventWhen(e)].filter(Boolean).join(' · ')}</Text>
                          </View>
                          {e.price_from != null ? (
                            <View style={styles.pricePill}>
                              <Text style={styles.priceText}>{Number(e.price_from) ? `From ${inr(e.price_from)}` : 'FREE'}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
                        <TouchableOpacity style={[styles.book, sold && styles.sold]} onPress={() => book(e)} disabled={sold} activeOpacity={0.85}>
                          <Text style={[styles.bookText, sold && { color: C.faint }]}>{sold ? 'SOLD OUT' : 'Book now'}</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                        <Text style={styles.closeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
            {events.length > 1 ? (
              <View style={styles.dots}>
                {events.map((e, i) => (
                  <View key={e.id} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
            ) : null}
            <TouchableOpacity style={styles.remind} onPress={onRemind} activeOpacity={0.85}>
              <Text style={styles.remindText}>Remind me later</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(8,8,12,0.88)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: C.card, borderRadius: 24, borderWidth: 3, borderColor: C.lime, overflow: 'hidden' },
  poster: { height: 380, backgroundColor: '#2A1B5E' },
  skeleton: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B1FE0' },
  skelText: { fontFamily: F.pixel, color: C.lime, fontSize: 16 },
  body: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  venue: { color: C.text, fontSize: 16, fontWeight: '900' },
  meta: { color: C.sub, fontSize: 13, marginTop: 2 },
  title: { fontFamily: F.display, color: C.text, fontSize: 18, marginTop: 8 },
  lead: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 8 },
  kicker: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  pricePill: { backgroundColor: C.lime, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, transform: [{ rotate: '-3deg' }] },
  priceText: { color: C.onLime, fontSize: 13, fontWeight: '900' },
  book: { backgroundColor: C.lime, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  sold: { backgroundColor: C.disabled },
  bookText: { color: C.onLime, fontSize: 17, fontWeight: '900' },
  close: { position: 'absolute', top: 10, right: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: C.onLime, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  dots: { flexDirection: 'row', marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border, marginHorizontal: 4 },
  dotOn: { width: 22, backgroundColor: C.lime },
  remind: { borderWidth: 2, borderColor: '#fff', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 22, marginTop: 16 },
  remindText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  later: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 12 },
});
