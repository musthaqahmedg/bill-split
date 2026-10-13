import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// A "Done" bar on top of the iPhone keypad, so you can always close it
// (number keypads have no return key). Android already has its own back/close.
export const DONE_ID = 'keyboard-done';

export default function KeyboardDone() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ID}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={Keyboard.dismiss} hitSlop={10}>
          <Text style={styles.done}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: C.cardHi, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'flex-end' },
  done: { color: C.accentSoft, fontSize: 17, fontWeight: '800' },
});
