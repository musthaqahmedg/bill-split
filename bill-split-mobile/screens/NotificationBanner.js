import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ICON, onNotification, openNotification } from '../services/notifications';
import { C } from '../services/theme';

// Slides down from the top when a notification arrives (like iPhone banners)
export default function NotificationBanner({ enabled }) {
  const [n, setN] = useState(null);
  const y = useRef(new Animated.Value(-140)).current;
  const timer = useRef(null);

  const hide = () =>
    Animated.timing(y, { toValue: -140, duration: 250, useNativeDriver: true }).start(() => setN(null));

  useEffect(() => {
    if (!enabled) return;
    return onNotification((item) => {
      setN(item);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(hide, 4500);
    });
  }, [enabled]);

  if (!n) return null;
  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: y }] }]}>
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.9}
        onPress={() => {
          hide();
          openNotification(n);
        }}
      >
        <Text style={styles.icon}>{ICON[n.kind] || '🔔'}</Text>
        <Text style={styles.flex} numberOfLines={2}>
          <Text style={styles.title}>{n.title}{'\n'}</Text>
          <Text style={styles.body}>{n.body}</Text>
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 54, left: 10, right: 10, zIndex: 100, elevation: 20 },
  banner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,28,36,0.97)', borderRadius: 20, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  icon: { fontSize: 24, marginRight: 12 },
  flex: { flex: 1 },
  title: { color: C.text, fontSize: 14, fontWeight: '700' },
  body: { color: C.sub, fontSize: 13 },
});
