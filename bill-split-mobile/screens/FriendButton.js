import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { respond, sendRequest } from '../services/friends';
import { C } from '../services/theme';

// "＋ Add friend" / "Requested" / "Accept" / "Friends ✓" for someone who is on Vibe Out
export default function FriendButton({ user, onChange }) {
  const [state, setState] = useState(user);
  if (!state) return null;

  const add = async () => {
    try {
      const st = await sendRequest(state.user_id);
      setState({ ...state, status: st, incoming: false });
      onChange && onChange();
    } catch (e) {
      Alert.alert("Couldn't send", e.message);
    }
  };
  const accept = async () => {
    try {
      await respond(state.user_id, true);
      setState({ ...state, status: 'accepted' });
      onChange && onChange();
    } catch (e) {
      Alert.alert("Couldn't accept", e.message);
    }
  };

  if (state.status === 'accepted') return <Text style={styles.done}>Friends ✓</Text>;
  if (state.status === 'pending' && state.incoming)
    return (
      <TouchableOpacity style={styles.btn} onPress={accept}>
        <Text style={styles.btnText}>Accept</Text>
      </TouchableOpacity>
    );
  if (state.status === 'pending') return <Text style={styles.done}>Requested</Text>;
  return (
    <TouchableOpacity style={styles.btn} onPress={add}>
      <Text style={styles.btnText}>＋ Add friend</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 10, marginRight: 8 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  done: { color: C.faint, fontSize: 12, fontWeight: '600', marginRight: 8 },
});
