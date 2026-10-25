import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

// 🎈 Emojis that float up the screen when someone reacts (Gautham's chat idea)
const FloatUp = forwardRef(function FloatUp(_props, ref) {
  const [bits, setBits] = useState([]);
  const id = useRef(0);
  const { width, height } = Dimensions.get('window');

  useImperativeHandle(ref, () => ({
    burst(emoji) {
      const fresh = Array.from({ length: 7 }).map((_, i) => ({
        key: ++id.current,
        emoji,
        x: width * 0.55 + (Math.random() - 0.5) * 120,
        size: 22 + Math.random() * 16,
        drift: (Math.random() - 0.5) * 80,
        v: new Animated.Value(0),
        delay: i * 70,
      }));
      setBits((b) => [...b, ...fresh]);
      fresh.forEach((f) =>
        Animated.timing(f.v, { toValue: 1, duration: 1400, delay: f.delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() =>
          setBits((b) => b.filter((x) => x.key !== f.key))
        )
      );
    },
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bits.map((b) => (
        <Animated.Text
          key={b.key}
          style={{
            position: 'absolute',
            left: b.x,
            top: height * 0.75,
            fontSize: b.size,
            opacity: b.v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.55] }) },
              { translateX: b.v.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
            ],
          }}
        >
          {b.emoji}
        </Animated.Text>
      ))}
    </View>
  );
});
export default FloatUp;
