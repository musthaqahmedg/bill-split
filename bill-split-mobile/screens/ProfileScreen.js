import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { deleteAccount, getProfile, isValidUpi, saveProfile } from '../services/profile';
import { C } from '../services/theme';

export default function ProfileScreen({ onBack, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [upi, setUpi] = useState('');

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setPhone(p.phone || '');
          setName(p.name || '');
          setUpi(p.upi_id || '');
        }
      })
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (upi.trim() && !isValidUpi(upi)) {
      Alert.alert('Check your UPI ID', 'It should look like name@bank, for example musthaq@okaxis');
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ name, upi_id: upi });
      Alert.alert('Saved ✅', 'Your profile is updated.');
    } catch (e) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and ALL your bills. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'Last chance. Everything will be gone.', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount();
                    onLogout();
                  } catch (e) {
                    Alert.alert("Couldn't delete", e.message);
                  }
                },
              },
            ]),
        },
      ]
    );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={C.accentSoft} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Your profile 👤</Text>
        <Text style={styles.phone}>{phone ? `+${phone.replace(/^\+/, '')}` : ''}</Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="What friends call you"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
        />

        <Text style={styles.label}>Your UPI ID</Text>
        <TextInput
          style={styles.input}
          value={upi}
          onChangeText={setUpi}
          placeholder="name@bank (e.g. musthaq@okaxis)"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          Friends will pay you here. Find it in GPay / PhonePe / Paytm under your profile.
        </Text>

        <TouchableOpacity style={styles.button} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL('https://bill-split-flax.vercel.app/privacy')}>
          <Text style={styles.linkText}>Privacy policy</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteText}>Delete my account</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: 60, paddingHorizontal: 20 },
  center: { justifyContent: 'center', alignItems: 'center' },
  back: { color: C.accentSoft, fontSize: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '800', color: C.text },
  phone: { color: C.faint, fontSize: 15, marginTop: 4, marginBottom: 24 },
  label: { color: C.sub, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, fontSize: 16, color: C.text, marginBottom: 16 },
  hint: { color: C.faint, fontSize: 13, marginTop: -8, marginBottom: 20, lineHeight: 18 },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 28 },
  logoutBtn: { borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  logoutText: { color: C.text, fontSize: 16, fontWeight: '700' },
  linkBtn: { padding: 12, alignItems: 'center' },
  linkText: { color: C.accentSoft, fontSize: 15 },
  deleteBtn: { padding: 14, alignItems: 'center', marginBottom: 40 },
  deleteText: { color: C.red, fontSize: 15 },
});