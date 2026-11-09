import { Alert, Dimensions, Image, Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Going } from './EventPopup';
import { EVENT_CATS, eventKm, eventPrice } from '../services/events';
import { C, F } from '../services/theme';

// 🎟️ One event: poster, when & where, price, about, who's going → Book now (organiser's link) / Plan with squad

const W = Dimensions.get('window').width;
const CAT_BG = { parties: C.pink, music: C.violet, comedy: '#FFD84D', festivals: C.cyan, activities: C.lime, games: '#FF8A3D' };

const fmtDay = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
function when(e) {
  const s = new Date(e.start_at);
  const end = e.end_at ? new Date(e.end_at) : null;
  const sameDay = end && end.toDateString() === s.toDateString();
  if (!end) return { day: fmtDay(s), time: `From ${fmtTime(s)}` };
  if (sameDay || end - s < 18 * 3600e3) return { day: fmtDay(s), time: `${fmtTime(s)} – ${fmtTime(end)}` };
  return { day: `${fmtDay(s)} – ${fmtDay(end)}`, time: `Starts ${fmtTime(s)}` };
}

export default function EventScreen({ event: e, onBack, onPlan }) {
  const c = EVENT_CATS.find((x) => x.key === e.category);
  const w = when(e);
  const price = eventPrice(e);
  const soldOut = e.status === 'sold_out';
  const tiers = Array.isArray(e.ticket_tiers) ? e.ticket_tiers.filter((t) => t && t.name) : [];

  const book = () => {
    if (!e.booking_url) return;
    Linking.openURL(e.booking_url).catch(() => Alert.alert("Couldn't open the link", e.booking_url));
  };
  const directions = () => {
    const url = e.lat != null && e.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.venue_name, e.city].filter(Boolean).join(', '))}`;
    Linking.openURL(url).catch(() => {});
  };
  const share = () =>
    Share.share({
      message: [`${c ? c.emoji + ' ' : ''}${e.title}`, `📅 ${w.day}, ${w.time}`, `📍 ${[e.venue_name, e.city].filter(Boolean).join(', ')}`, price ? `🎟️ ${price}` : null, e.booking_url || null, '', 'Found on VibeOut 🌙']
        .filter((x) => x !== null).join('\n'),
    }).catch(() => {});

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Poster */}
        <View>
          {e.poster_url ? (
            <Image source={{ uri: e.poster_url }} style={styles.poster} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.poster, styles.block, { backgroundColor: CAT_BG[e.category] || C.violet }]}>
              <Text style={{ fontSize: 80 }}>{c ? c.emoji : '🌙'}</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.round, { left: 16 }]} onPress={onBack} accessibilityLabel="Back" hitSlop={8}>
            <Text style={styles.roundText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.round, { right: 16 }]} onPress={share} accessibilityLabel="Share event" hitSlop={8}>
            <Text style={[styles.roundText, { fontSize: 18 }]}>↗</Text>
          </TouchableOpacity>
          {soldOut ? <View style={styles.sold}><Text style={styles.soldText}>SOLD OUT</Text></View> : null}
        </View>

        <View style={styles.body}>
          {c ? <Text style={styles.cat}>{c.emoji} {c.label.toUpperCase()}</Text> : null}
          <Text style={styles.title}>{e.title}</Text>

          <View style={styles.box}>
            <View style={styles.line}>
              <Text style={styles.icon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.main}>{w.day}</Text>
                <Text style={styles.sub}>{w.time}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.line, styles.sep]} onPress={directions} activeOpacity={0.7}>
              <Text style={styles.icon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.main}>{e.venue_name}</Text>
                <Text style={styles.sub}>{[e.city, eventKm(e.km)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={styles.link}>Directions ›</Text>
            </TouchableOpacity>
            {price ? (
              <View style={[styles.line, styles.sep]}>
                <Text style={styles.icon}>🎟️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.main, soldOut && { color: C.red }]}>{price}</Text>
                  {tiers.length ? tiers.map((t, i) => (
                    <Text key={i} style={styles.sub}>{t.name}{t.price != null ? ` · ₹${Math.round(t.price).toLocaleString('en-IN')}` : ''}</Text>
                  )) : null}
                </View>
              </View>
            ) : null}
          </View>

          <Going id={e.id} />

          {e.description ? (
            <>
              <Text style={styles.label}>ABOUT</Text>
              <Text style={styles.about}>{e.description}</Text>
            </>
          ) : null}

          <Text style={styles.note}>
            {e.booking_url ? 'Tickets are sold by the organiser. "Book now" opens their page.' : 'No online tickets — entry or tickets at the venue.'}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky actions */}
      <View style={styles.bar}>
        <TouchableOpacity style={styles.plan} onPress={() => onPlan(e)} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.planText}>👯 Plan with squad</Text>
        </TouchableOpacity>
        {e.booking_url ? (
          <TouchableOpacity style={[styles.book, soldOut && styles.off]} onPress={book} disabled={soldOut} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.bookText}>{soldOut ? 'Sold out' : 'Book now'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  poster: { width: W, height: W * 1.15 },
  block: { alignItems: 'center', justifyContent: 'center' },
  round: { position: 'absolute', top: 54, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,14,18,0.7)', alignItems: 'center', justifyContent: 'center' },
  roundText: { color: C.text, fontSize: 26, fontWeight: '800', marginTop: -2 },
  sold: { position: 'absolute', bottom: 14, left: 20, backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  soldText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  cat: { fontFamily: F.pixel, color: C.lime, fontSize: 11 },
  title: { fontFamily: F.display, color: C.text, fontSize: 28, marginTop: 6 },
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, paddingHorizontal: 14, marginTop: 16 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  sep: { borderTopWidth: 1, borderTopColor: C.border },
  icon: { fontSize: 20, marginRight: 12 },
  main: { color: C.text, fontSize: 15, fontWeight: '800' },
  sub: { color: C.sub, fontSize: 13, marginTop: 2 },
  link: { color: C.lime, fontSize: 13, fontWeight: '800' },
  label: { fontFamily: F.pixel, color: C.sub, fontSize: 11, marginTop: 22, marginBottom: 8 },
  about: { color: C.text, fontSize: 15, lineHeight: 22 },
  note: { color: C.faint, fontSize: 12, marginTop: 20 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border },
  plan: { flex: 1, borderWidth: 2, borderColor: C.lime, borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  planText: { color: C.lime, fontSize: 15, fontWeight: '900' },
  book: { flex: 1, backgroundColor: C.lime, borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginLeft: 10 },
  bookText: { fontFamily: F.display, color: C.onLime, fontSize: 16 },
  off: { backgroundColor: C.disabled },
});
