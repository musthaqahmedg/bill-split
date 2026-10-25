import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sendMessage } from '../services/chat';
import { CHARADES, DARES, MOST_LIKELY, NEVER, TRUTHS, WHEEL_REASONS, WOULD_RATHER, pick } from '../services/games';
import { getProfile } from '../services/profile';
import { C, F } from '../services/theme';

const COLORS = ['#9B5CFF', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA', '#F87171', '#A3E635'];

// 🎮 Party games: spin the wheel, never have I ever, truth or dare, charades
export default function PartyGames({ visible, onClose, party }) {
  const [game, setGame] = useState(null);
  const [myName, setMyName] = useState('Host');
  const members = (party.party_members || []).filter((m) => m.rsvp !== 'out');
  const players = members.map((m) => (m.name === 'Me' ? myName : m.name));
  const me = members.find((m) => m.name === 'Me');

  useEffect(() => {
    if (visible) {
      setGame(null);
      getProfile().then((p) => p && p.name && setMyName(p.name)).catch(() => {});
    }
  }, [visible]);

  const post = async (text) => {
    try {
      await sendMessage({ partyId: party.id, memberId: me && me.id, senderName: myName, body: text });
      Alert.alert('Posted to the party chat 💬');
    } catch (e) {
      Alert.alert("Couldn't post", e.message);
    }
  };

  const GAMES = [
    { key: 'wheel', emoji: '🎡', name: 'Spin the wheel', sub: 'Who picks the song? Let fate decide', color: '#9B5CFF' },
    { key: 'never', emoji: '🙋', name: 'Never have I ever', sub: 'Clean, funny confessions', color: '#EC4899' },
    { key: 'tod', emoji: '🎭', name: 'Truth or dare', sub: 'Pass the phone around', color: '#F59E0B' },
    { key: 'charades', emoji: '🤫', name: 'Charades', sub: 'Act it out, 60 seconds', color: '#22D3EE' },
    { key: 'likely', emoji: '👉', name: 'Most likely to…', sub: 'Point at the friend', color: '#A855F7' },
    { key: 'rather', emoji: '🤔', name: 'Would you rather', sub: 'Pick a side, defend it', color: '#34D399' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.top}>
          {game ? (
            <TouchableOpacity onPress={() => setGame(null)}>
              <Text style={styles.link}>‹ Games</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.title}>🎮 Party games</Text>
          )}
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.link}>Done</Text>
          </TouchableOpacity>
        </View>

        {!game && (
          <ScrollView>
            <Text style={styles.sub}>{players.length} players · no drinking games, just good vibes 😎</Text>
            <View style={styles.grid}>
              {GAMES.map((g) => (
                <TouchableOpacity key={g.key} style={[styles.tile, { backgroundColor: g.color + '26', borderColor: g.color + '88' }]} onPress={() => setGame(g.key)} activeOpacity={0.85}>
                  <Text style={styles.tileEmoji}>{g.emoji}</Text>
                  <Text style={styles.tileName}>{g.name}</Text>
                  <Text style={styles.tileSub}>{g.sub}</Text>
                  <View style={[styles.tilePlay, { backgroundColor: g.color }]}>
                    <Text style={styles.tilePlayText}>Play ›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {game === 'wheel' && <Wheel players={players} onPost={post} />}
        {game === 'never' && <Deck title="🙋 Never have I ever" cards={NEVER} color="#EC4899" hint="Put a finger down if you have 😅" />}
        {game === 'tod' && <TruthOrDare players={players} />}
        {game === 'charades' && <Charades />}
        {game === 'likely' && <MostLikely players={players} onPost={post} />}
        {game === 'rather' && <Deck title="🤔 Would you rather" cards={WOULD_RATHER} color="#34D399" hint="Everyone picks a side. Losers explain why 😄" />}
      </View>
    </Modal>
  );
}

// 🎡 Wheel of names
function Wheel({ players, onPost }) {
  const spin = useRef(new Animated.Value(0)).current;
  const [angle, setAngle] = useState(0);
  const [winner, setWinner] = useState(null);
  const [reason, setReason] = useState(WHEEL_REASONS[0]);
  const [spinning, setSpinning] = useState(false);
  const n = Math.max(players.length, 1);
  const seg = 360 / n;
  const R = 120;

  const go = () => {
    if (spinning || !players.length) return;
    setWinner(null);
    setSpinning(true);
    const w = Math.floor(Math.random() * n);
    // land player w under the pointer at the top
    const base = Math.ceil(angle / 360) * 360;
    const end = base + 360 * 5 + ((360 - w * seg) % 360);
    Animated.timing(spin, { toValue: end, duration: 4200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setAngle(end);
      setWinner(players[w]);
      setSpinning(false);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.center}>
      <Text style={styles.gameTitle}>🎡 Spin the wheel</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasons}>
        {WHEEL_REASONS.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, reason === r && styles.chipOn]} onPress={() => setReason(r)}>
            <Text style={[styles.chipText, reason === r && styles.chipTextOn]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.pointer}>▼</Text>
      <Animated.View
        style={[
          styles.wheel,
          { width: R * 2 + 60, height: R * 2 + 60, borderRadius: R + 30 },
          { transform: [{ rotate: spin.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] },
        ]}
      >
        {players.map((p, i) => {
          const a = (i * seg * Math.PI) / 180;
          return (
            <View
              key={p + i}
              style={[
                styles.slice,
                {
                  backgroundColor: COLORS[i % COLORS.length],
                  left: R + 30 + R * Math.sin(a) - 42,
                  top: R + 30 - R * Math.cos(a) - 15,
                  transform: [{ rotate: `${i * seg}deg` }],
                },
              ]}
            >
              <Text style={styles.sliceText} numberOfLines={1}>{p.split(' ')[0]}</Text>
            </View>
          );
        })}
        <View style={styles.hub}>
          <Text style={styles.hubText}>🎉</Text>
        </View>
      </Animated.View>

      {winner ? (
        <View style={styles.result}>
          <Text style={styles.resultBig}>{winner}</Text>
          <Text style={styles.resultSmall}>{reason}</Text>
          <TouchableOpacity style={styles.ghost} onPress={() => onPost(`🎡 The wheel has spoken: ${winner} ${reason}`)}>
            <Text style={styles.ghostText}>💬 Post to party chat</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.bigBtn, spinning && styles.dim]} onPress={go} disabled={spinning}>
        <Text style={styles.bigBtnText}>{spinning ? 'Spinning…' : winner ? 'Spin again 🔄' : 'SPIN 🎡'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// A deck of cards with a flip-in animation
function Deck({ title, cards, color, hint }) {
  const [card, setCard] = useState(() => pick(cards));
  const flip = useRef(new Animated.Value(1)).current;
  const next = () => {
    Animated.sequence([
      Animated.timing(flip, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(flip, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCard((c) => pick(cards, c)), 140);
  };
  return (
    <View style={styles.center}>
      <Text style={styles.gameTitle}>{title}</Text>
      {hint ? <Text style={styles.sub}>{hint}</Text> : null}
      <Animated.View style={[styles.bigCard, { backgroundColor: color, transform: [{ scaleX: flip }] }]}>
        <Text style={styles.bigCardText}>{card}</Text>
      </Animated.View>
      <TouchableOpacity style={styles.bigBtn} onPress={next}>
        <Text style={styles.bigBtnText}>Next card ›</Text>
      </TouchableOpacity>
    </View>
  );
}

// 👉 Most likely to…: read it out, everyone points, tap who won, post it to the chat
function MostLikely({ players, onPost }) {
  const [card, setCard] = useState(() => pick(MOST_LIKELY));
  const [winner, setWinner] = useState(null);
  const next = () => {
    setWinner(null);
    setCard((c) => pick(MOST_LIKELY, c));
  };
  return (
    <ScrollView contentContainerStyle={styles.center}>
      <Text style={styles.gameTitle}>👉 Most likely to…</Text>
      <Text style={styles.sub}>3, 2, 1… everyone point!</Text>
      <View style={[styles.bigCard, { backgroundColor: '#A855F7' }]}>
        <Text style={styles.bigCardText}>{card}</Text>
      </View>
      <View style={styles.names}>
        {players.map((n) => (
          <TouchableOpacity key={n} style={[styles.nameChip, winner === n && styles.nameOn]} onPress={() => setWinner(n)}>
            <Text style={[styles.nameText, winner === n && styles.nameTextOn]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {winner ? (
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: '#A855F7' }]} onPress={() => onPost(`👉 ${card.replace('Who is most likely to', 'Most likely to')} → ${winner} 😂`)}>
          <Text style={styles.bigBtnText}>Post to chat 💬</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.bigBtn} onPress={next}>
        <Text style={styles.bigBtnText}>Next card ›</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// 🎭 Truth or dare: random player, then they choose
function TruthOrDare({ players }) {
  const [who, setWho] = useState(() => pick(players));
  const [kind, setKind] = useState(null);
  const [card, setCard] = useState('');
  const choose = (k) => {
    setKind(k);
    setCard(pick(k === 'truth' ? TRUTHS : DARES, card));
  };
  return (
    <View style={styles.center}>
      <Text style={styles.gameTitle}>🎭 Truth or dare</Text>
      <Text style={styles.turn}>It’s <Text style={styles.turnName}>{who || 'your'}</Text> turn</Text>
      {kind ? (
        <View style={[styles.bigCard, { backgroundColor: kind === 'truth' ? '#22D3EE' : '#F87171' }]}>
          <Text style={styles.cardKind}>{kind === 'truth' ? 'TRUTH' : 'DARE'}</Text>
          <Text style={styles.bigCardText}>{card}</Text>
        </View>
      ) : (
        <View style={styles.todRow}>
          <TouchableOpacity style={[styles.todBtn, { backgroundColor: '#22D3EE' }]} onPress={() => choose('truth')}>
            <Text style={styles.todText}>Truth 🤔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.todBtn, { backgroundColor: '#F87171' }]} onPress={() => choose('dare')}>
            <Text style={styles.todText}>Dare 😈</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        style={styles.bigBtn}
        onPress={() => {
          setWho(pick(players, who));
          setKind(null);
        }}
      >
        <Text style={styles.bigBtnText}>Next player ›</Text>
      </TouchableOpacity>
    </View>
  );
}

// 🤫 Charades: 60 seconds, act it out, count the score
function Charades() {
  const [cat, setCat] = useState(Object.keys(CHARADES)[0]);
  const [word, setWord] = useState(null);
  const [time, setTime] = useState(0);
  const [score, setScore] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);
  const start = () => {
    setScore(0);
    setWord(pick(CHARADES[cat]));
    setTime(60);
    clearInterval(timer.current);
    timer.current = setInterval(() => setTime((t) => {
      if (t <= 1) {
        clearInterval(timer.current);
        return 0;
      }
      return t - 1;
    }), 1000);
  };
  const next = (got) => {
    if (got) setScore((s) => s + 1);
    setWord((w) => pick(CHARADES[cat], w));
  };
  const playing = time > 0;

  return (
    <View style={styles.center}>
      <Text style={styles.gameTitle}>🤫 Charades</Text>
      {!playing ? (
        <>
          <View style={styles.cats}>
            {Object.keys(CHARADES).map((c) => (
              <TouchableOpacity key={c} style={[styles.chip, cat === c && styles.chipOn]} onPress={() => setCat(c)}>
                <Text style={[styles.chipText, cat === c && styles.chipTextOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {word ? <Text style={styles.final}>⏰ Time! Score: {score} 🎉</Text> : <Text style={styles.sub}>Hold the phone so only the actor sees the word. No talking!</Text>}
          <TouchableOpacity style={styles.bigBtn} onPress={start}>
            <Text style={styles.bigBtnText}>{word ? 'Play again' : 'Start 60s ⏱️'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.timer, time <= 10 && { color: C.red }]}>{time}s</Text>
          <View style={[styles.bigCard, { backgroundColor: '#22D3EE' }]}>
            <Text style={styles.bigCardText}>{word}</Text>
          </View>
          <Text style={styles.sub}>Score: {score}</Text>
          <View style={styles.todRow}>
            <TouchableOpacity style={[styles.todBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]} onPress={() => next(false)}>
              <Text style={styles.todText}>Skip ⏭️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.todBtn, { backgroundColor: C.green }]} onPress={() => next(true)}>
              <Text style={[styles.todText, { color: '#06281C' }]}>Got it ✅</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48.5%', borderWidth: 1, borderRadius: 22, padding: 14, marginBottom: 10, minHeight: 170 },
  tileEmoji: { fontSize: 34 },
  tileName: { fontFamily: F.bold, color: C.text, fontSize: 15, marginTop: 8 },
  tileSub: { color: C.sub, fontSize: 12, marginTop: 3, flex: 1 },
  tilePlay: { alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 5, paddingHorizontal: 12, marginTop: 10 },
  tilePlayText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  names: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 },
  nameChip: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, margin: 4 },
  nameOn: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  nameText: { color: C.text, fontSize: 14, fontWeight: '700' },
  nameTextOn: { color: '#fff' },
  page: { flex: 1, backgroundColor: C.bg, padding: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: F.display, color: C.text, fontSize: 23 },
  link: { color: C.accentSoft, fontSize: 16, fontWeight: '600' },
  sub: { color: C.faint, fontSize: 13, marginBottom: 14, textAlign: 'center' },
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1 },
  cardEmoji: { fontSize: 34, marginRight: 14 },
  cardName: { color: C.text, fontSize: 17, fontWeight: '700' },
  cardSub: { color: C.sub, fontSize: 13, marginTop: 2 },
  chev: { color: 'rgba(255,255,255,0.4)', fontSize: 24 },
  center: { alignItems: 'center', paddingBottom: 40 },
  gameTitle: { fontFamily: F.bold, color: C.text, fontSize: 22, marginBottom: 8 },
  reasons: { maxHeight: 44, marginBottom: 10 },
  chip: { borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.sub, fontSize: 13, fontWeight: '500' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  pointer: { color: C.text, fontSize: 28, marginBottom: -6, zIndex: 2 },
  wheel: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)' },
  slice: { position: 'absolute', width: 84, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  sliceText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hub: { position: 'absolute', left: '50%', top: '50%', width: 56, height: 56, marginLeft: -28, marginTop: -28, borderRadius: 28, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  hubText: { fontSize: 24 },
  result: { alignItems: 'center', marginTop: 18 },
  resultBig: { color: C.text, fontSize: 30, fontWeight: '800' },
  resultSmall: { color: C.pink, fontSize: 16, fontWeight: '600', marginTop: 2 },
  ghost: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  ghostText: { color: C.text, fontSize: 13, fontWeight: '600' },
  bigBtn: { marginTop: 22, backgroundColor: C.accent, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 40 },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  dim: { opacity: 0.6 },
  bigCard: { width: '100%', minHeight: 230, borderRadius: 24, padding: 26, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  bigCardText: { fontFamily: F.bold, color: '#fff', fontSize: 24, textAlign: 'center', lineHeight: 29 },
  cardKind: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  turn: { color: C.sub, fontSize: 16, marginBottom: 6 },
  turnName: { color: C.text, fontWeight: '800' },
  todRow: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  todBtn: { flex: 1, borderRadius: 20, paddingVertical: 26, alignItems: 'center' },
  todText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 10 },
  final: { color: C.text, fontSize: 22, fontWeight: '800', marginVertical: 10 },
  timer: { color: C.text, fontSize: 56, fontWeight: '800' },
});
