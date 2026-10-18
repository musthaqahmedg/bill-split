import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { C } from '../services/theme';

// Avatar with a softly pulsing green ring when the friend is active now
export default function Pulse({ name, on, size = 48, style, uri }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(
      Animated.timing(p, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [on]);

  const hue = ['#8B5CF6', '#EC4899', '#22D3EE', '#F59E0B', '#34D399', '#60A5FA'][((name || '?').charCodeAt(0) || 0) % 6];
  return (
    <View style={[{ width: size, height: size }, style]}>
      {on ? (
        <Animated.View
          style={[
            styles.ring,
            { width: size, height: size, borderRadius: size / 2 },
            { opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] },
          ]}
        />
      ) : null}
      <View style={[styles.face, { width: size, height: size, borderRadius: size / 2, backgroundColor: hue + '33', borderColor: on ? C.green : 'rgba(255,255,255,0.12)' }]}>
        {uri ? (
          <Image source={{ uri }} style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }} />
        ) : (
          <Text style={[styles.letter, { fontSize: size * 0.4, color: hue }]}>{(name || '?')[0].toUpperCase()}</Text>
        )}
      </View>
      {on ? <View style={[styles.dot, { width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', backgroundColor: C.green },
  face: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, overflow: 'hidden' },
  letter: { fontWeight: '700' },
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg },
});
