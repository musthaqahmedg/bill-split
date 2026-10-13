import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// A "Done" bar that sits right on top of the keypad whenever it's open,
// so the keypad can always be closed (number keypads have no return key).
// Put <KeyboardDone /> as the LAST child of a full-screen container.
export const DONE_ID = 'keyboard-done'; // kept so inputs that still pass it don't break

export default function KeyboardDone() {
  const [visible, setVisible] = useState(false);
  const [lift, setLift] = useState(0); // keypad height (iPhone): the bar sits just above it

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => {
      setLift(Platform.OS === 'ios' ? e.endCoordinates.height : 0);
      setVisible(true);
    });
    const b = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  if (!visible) return null;
  return (
    <View style={[styles.bar, { bottom: lift }]} pointerEvents="box-none">
      <TouchableOpacity style={styles.btn} onPress={Keyboard.dismiss} hitSlop={10}>
        <Text style={styles.done}>Done ⌄</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 },
  btn: { backgroundColor: C.accent, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  done: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
