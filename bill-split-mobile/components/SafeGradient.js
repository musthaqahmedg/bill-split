import { Platform, View } from 'react-native';

// 🌈 Gradient that never crashes: if this build of the app doesn't have the gradient piece yet
// (older installed builds getting an over-the-air update), it falls back to a solid colour.
let Real = null;
try {
  const { requireOptionalNativeModule } = require('expo-modules-core');
  const has = Platform.OS === 'web' || !!requireOptionalNativeModule('ExpoLinearGradient');
  if (has) Real = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  Real = null;
}

export function LinearGradient({ colors = [], style, children, ...rest }) {
  if (Real) return <Real colors={colors} style={style} {...rest}>{children}</Real>;
  return <View style={[style, { backgroundColor: colors[colors.length > 1 ? 1 : 0] || 'transparent' }]}>{children}</View>;
}
