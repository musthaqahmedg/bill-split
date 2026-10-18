import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { avatarUrl, deleteAccount, getProfile, isValidUpi, pickAvatar, saveProfile } from '../services/profile';
import Pulse from './Pulse';
import { levelOf, myXp } from '../services/xp';
import { getShowActive, setShowActive } from '../services/active';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import { C } from '../services/theme';

export default function ProfileScreen({ onBack, onLogout }) {
  const [showActive, setShowActiveState] = useState(true);
  useEffect(() => {
    getShowActive().then(setShowActiveState).catch(() => {});
  }, []);
  const toggleActive = async (on) => {
    setShowActiveState(on);
    try {
      await setShowActive(on);
    } catch (e) {
      setShowActiveState(!on);
      Alert.alert("Couldn't save", e.message);
    }
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [upi, setUpi] = useState('');
  const [bio, setBio] = useState('');
  const [insta, setInsta] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [xp, setXp] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setPhone(p.phone || '');
          setName(p.name || '');
          setUpi(p.upi_id || '');
          setBio(p.bio || '');
          setInsta(p.instagram || '');
          setLinkedin(p.linkedin || '');
          setAvatar(p.avatar_path || null);
        }
      })
      .catch((e) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
    myXp().then((d) => setXp(d.xp)).catch(() => {});
  }, []);

  const changePhoto = async () => {
    setUploading(true);
    try {
      const path = await pickAvatar();
      if (path) setAvatar(path);
    } catch (e) {
      Alert.alert("Couldn't change photo", e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (upi.trim() && !isValidUpi(upi)) {
      Alert.alert('Check your UPI ID', 'It should look like name@bank, for example musthaq@okaxis');
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ name, upi_id: upi, bio, instagram: insta, linkedin });
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

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.hero}>
          <TouchableOpacity onPress={changePhoto} disabled={uploading}>
            <Pulse name={name || '?'} uri={avatarUrl(avatar)} size={96} />
            <View style={styles.camera}>
              <Text style={styles.cameraText}>{uploading ? '…' : '📷'}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.heroName}>{name || 'Your name'}</Text>
          <Text style={styles.phone}>{phone ? `+${phone.replace(/^\+/, '')}` : ''}</Text>
          {xp !== null ? (
            <Text style={styles.level}>{levelOf(xp).emoji} {levelOf(xp).name} · {xp} XP</Text>
          ) : null}
        </View>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID}
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="What friends call you"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
        />

        <View style={styles.activeRow}>
          <View style={styles.activeText}>
            <Text style={styles.activeTitle}>🟢 Show activity status</Text>
            <Text style={styles.activeSub}>Friends in your plans and groups see when you're active. Turn off to hide it (you won't see theirs either).</Text>
          </View>
          <Switch value={showActive} onValueChange={toggleActive} trackColor={{ true: C.green }} />
        </View>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID}
          style={[styles.input, styles.bio]}
          value={bio}
          onChangeText={setBio}
          placeholder="Who are you? (e.g. Biryani lover · DJ on weekends 🎧)"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
          maxLength={150}
          multiline
        />

        <Text style={styles.label}>Instagram</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID}
          style={styles.input}
          value={insta}
          onChangeText={setInsta}
          placeholder="@yourhandle"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>LinkedIn</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID}
          style={styles.input}
          value={linkedin}
          onChangeText={setLinkedin}
          placeholder="linkedin.com/in/yourname"
          placeholderTextColor={C.faint}
          keyboardAppearance="dark"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hintSmall}>Only your friends on Vibe Out can see your photo, bio and links.</Text>

        <Text style={styles.label}>Your UPI ID</Text>
        <TextInput
          inputAccessoryViewID={DONE_ID}
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
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 6, marginBottom: 6 },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  cameraText: { fontSize: 14 },
  heroName: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 10 },
  level: { color: C.amber, fontSize: 13, fontWeight: '700', marginTop: 4 },
  bio: { minHeight: 70, textAlignVertical: 'top' },
  hintSmall: { color: C.faint, fontSize: 12, marginTop: 6 },
  activeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginTop: 14 },
  activeText: { flex: 1, marginRight: 10 },
  activeTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  activeSub: { color: C.faint, fontSize: 12, marginTop: 2 },
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