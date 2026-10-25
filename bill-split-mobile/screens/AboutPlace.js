import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C, F } from '../services/theme';

// Home / current location: nothing to look up
const isPersonal = (p) => /^my place|current location/i.test((p || '').trim());

const W = Dimensions.get('window').width - 40;

// "About this place": photos + a short story about the place (from Wikipedia, free and credited).
// Shows nothing if we can't find the place.
export default function AboutPlace({ place }) {
  const [info, setInfo] = useState(undefined); // undefined = loading, null = nothing found
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);

  useEffect(() => {
    let alive = true;
    setInfo(undefined);
    if (isPersonal(place)) return;
    setPage(0);
    setMore(false);
    // Wait until typing stops
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke('place_info', { body: { name: place } });
        if (alive) setInfo((data && data.info) || null);
      } catch (e) {
        if (alive) setInfo(null);
      }
    }, 800);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [place]);

  if (!place || info === null || isPersonal(place)) return null;
  if (info === undefined) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={C.accentSoft} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {info.images.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
          >
            {info.images.map((src) => (
              <Image key={src} source={{ uri: src }} style={styles.photo} resizeMode="cover" />
            ))}
          </ScrollView>
          {info.images.length > 1 && (
            <View style={styles.dots}>
              {info.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          )}
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.kicker}>📖 ABOUT THIS PLACE</Text>
        <Text style={styles.title}>{info.title}</Text>
        {info.description ? <Text style={styles.desc}>{info.description}</Text> : null}
        {info.extract ? (
          <Text style={styles.extract} numberOfLines={more ? undefined : 4} onPress={() => setMore(!more)}>
            {info.extract}
          </Text>
        ) : null}
        <View style={styles.row}>
          {info.extract ? (
            <TouchableOpacity onPress={() => setMore(!more)}>
              <Text style={styles.link}>{more ? 'Show less' : 'Read more'}</Text>
            </TouchableOpacity>
          ) : <View />}
          {info.url ? (
            <TouchableOpacity onPress={() => Linking.openURL(info.url)}>
              <Text style={styles.credit}>Photos & text: Wikipedia ↗</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, marginBottom: 16, overflow: 'hidden', minHeight: 60, justifyContent: 'center' },
  photo: { width: W, height: 200, backgroundColor: C.cardHi },
  dots: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)', marginHorizontal: 3 },
  dotOn: { backgroundColor: '#fff', width: 16 },
  text: { padding: 14 },
  kicker: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontFamily: F.display, color: C.text, fontSize: 19, marginTop: 4 },
  desc: { color: C.accentSoft, fontSize: 13, marginTop: 2 },
  extract: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  link: { color: C.accentSoft, fontSize: 13, fontWeight: '800' },
  credit: { color: C.faint, fontSize: 11 },
});
