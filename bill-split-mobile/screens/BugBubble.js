import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text } from 'react-native';

// 🐞 Testers only: a floating bug bubble (like a chat head). Drag it anywhere, it snaps to the nearest side.
// Tap to report. Its spot is remembered.
const SIZE = 40;
const KEY = 'vibeout.bugBubble';

export default function BugBubble({ onPress }) {
  const { width, height } = Dimensions.get('window');
  const pos = useRef(new Animated.ValueXY({ x: width - SIZE - 6, y: height * 0.45 })).current;
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!v) return;
        const p = JSON.parse(v);
        pos.setValue({ x: p.side === 'left' ? 6 : width - SIZE - 6, y: Math.min(Math.max(p.y, 70), height - 140) });
      })
      .catch(() => {});
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // keep the drag, don't let the page steal it
      onPanResponderGrant: () => {
        moved.current = false;
        start.current = { x: pos.x._value, y: pos.y._value };
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: false }).start();
      },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) moved.current = true;
        pos.setValue({ x: start.current.x + g.dx, y: start.current.y + g.dy });
      },
      onPanResponderTerminate: () => snap(),
      onPanResponderRelease: () => {
        Animated.timing(opacity, { toValue: 0.7, duration: 300, useNativeDriver: false }).start();
        if (!moved.current) {
          try {
            Haptics.selectionAsync();
          } catch (e) {}
          pos.setValue(start.current);
          return onPress();
        }
        snap();
      },
    })
  ).current;

  // snap to the nearest side, stay clear of the top bar and bottom tabs
  function snap() {
        Animated.timing(opacity, { toValue: 0.7, duration: 300, useNativeDriver: false }).start();
        const left = pos.x._value + SIZE / 2 < width / 2;
        const y = Math.min(Math.max(pos.y._value, 70), height - 140);
        Animated.spring(pos, { toValue: { x: left ? 6 : width - SIZE - 6, y }, useNativeDriver: false, friction: 7 }).start();
        AsyncStorage.setItem(KEY, JSON.stringify({ side: left ? 'left' : 'right', y })).catch(() => {});
  }

  return (
    <Animated.View {...pan.panHandlers} style={[styles.bubble, { opacity, transform: pos.getTranslateTransform() }]}>
      <Text style={styles.icon}>🐞</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(24,24,31,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  icon: { fontSize: 19 },
});
