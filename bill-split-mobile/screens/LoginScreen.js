import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { C } from '../services/theme';

// Accepts "8606670896", "918606670896" or "+918606670896" → "+918606670896"
const toE164 = (raw) => {
  const s = raw.replace(/[\s-]/g, '');
  if (s.startsWith('+')) return s;
  if (/^\d{10}$/.test(s)) return '+91' + s;
  if (/^91\d{10}$/.test(s)) return '+' + s;
  return s;
};

export default function LoginScreen({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone number needed', 'Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
      if (error) throw error;
      setShowOtp(true);
    } catch (error) {
      Alert.alert("Couldn't send the code", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Code needed', 'Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: otp, type: 'sms' });
      if (error) throw error;
      onLoginSuccess();
    } catch (error) {
      Alert.alert("That code didn't work", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🌙</Text>
      <Text style={styles.title}>Vibe Out</Text>
      <Text style={styles.subtitle}>The night, sorted ✨</Text>

      {!showOtp ? (
        <>
          <Text style={styles.label}>Your phone number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.code}>
              <Text style={styles.codeText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="98765 43210"
              placeholderTextColor={C.faint}
              keyboardAppearance="dark"
              value={phone}
              onChangeText={setPhone}
              editable={!loading}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter the code sent to +91 {phone.replace(/^\+?91/, '')}</Text>
          <TextInput
            style={[styles.input, styles.otpInput]}
            placeholder="••••••"
            placeholderTextColor={C.faint}
            keyboardAppearance="dark"
            value={otp}
            onChangeText={setOtp}
            editable={!loading}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Let's go</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowOtp(false); setOtp(''); }}>
            <Text style={styles.link}>Change number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: C.bg },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: C.text, marginTop: 8 },
  subtitle: { fontSize: 16, color: C.accentSoft, marginTop: 6, marginBottom: 40, textAlign: 'center' },
  label: { color: C.sub, fontSize: 14, marginBottom: 8 },
  phoneRow: { flexDirection: 'row' },
  code: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', marginRight: 10, marginBottom: 15 },
  codeText: { color: C.text, fontSize: 16, fontWeight: '600' },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 15, marginBottom: 15, borderRadius: 14, fontSize: 17, color: C.text },
  phoneInput: { flex: 1 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  link: { color: C.accentSoft, textAlign: 'center', marginTop: 18, fontSize: 15 },
});