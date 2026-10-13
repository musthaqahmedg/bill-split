import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
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

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export default function LoginScreen({ onLoginSuccess }) {
  const [method, setMethod] = useState('email'); // 'email' (free code by email) or 'phone' (test numbers)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  const handleSendOtp = async () => {
    if (method === 'email' && !isEmail(email)) {
      Alert.alert('Email needed', 'Please enter a valid email address');
      return;
    }
    if (method === 'phone' && !phone.trim()) {
      Alert.alert('Phone number needed', 'Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp(
        method === 'email' ? { email: cleanEmail } : { phone: toE164(phone) }
      );
      if (error) throw error;
      setShowOtp(true);
    } catch (error) {
      Alert.alert("Couldn't send the code", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    Keyboard.dismiss();
    if (!otp.trim()) {
      Alert.alert('Code needed', 'Please enter the code');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp(
        method === 'email'
          ? { email: cleanEmail, token: otp.trim(), type: 'email' }
          : { phone: toE164(phone), token: otp.trim(), type: 'sms' }
      );
      if (error) throw error;
      onLoginSuccess();
    } catch (error) {
      Alert.alert("That code didn't work", error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMethod = (m) => {
    setMethod(m);
    setShowOtp(false);
    setOtp('');
  };

  // Tap anywhere outside a box to hide the keypad; the screen also moves up above the keypad
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.logo}>🌙</Text>
      <Text style={styles.title}>Vibe Out</Text>
      <Text style={styles.subtitle}>The night, sorted ✨</Text>

      {!showOtp ? (
        <>
          {method === 'email' ? (
            <>
              <Text style={styles.label}>Your email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@gmail.com"
                placeholderTextColor={C.faint}
                keyboardAppearance="dark"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : (
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
            </>
          )}

          <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => switchMethod(method === 'email' ? 'phone' : 'email')}>
            <Text style={styles.link}>
              {method === 'email' ? 'Use phone number instead' : 'Use email instead'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>
            {method === 'email'
              ? `Enter the code we emailed to ${cleanEmail}`
              : `Enter the code sent to +91 ${phone.replace(/^\+?91/, '')}`}
          </Text>
          {method === 'email' && <Text style={styles.hint}>Can't find it? Check your spam folder 📩</Text>}
          <TextInput
            style={[styles.input, styles.otpInput]}
            placeholder="••••••"
            placeholderTextColor={C.faint}
            keyboardAppearance="dark"
            value={otp}
            onChangeText={setOtp}
            editable={!loading}
            keyboardType="number-pad"
            maxLength={8}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Let's go</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowOtp(false); setOtp(''); }}>
            <Text style={styles.link}>{method === 'email' ? 'Change email' : 'Change number'}</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: C.bg },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: C.text, marginTop: 8 },
  subtitle: { fontSize: 16, color: C.accentSoft, marginTop: 6, marginBottom: 40, textAlign: 'center' },
  label: { color: C.sub, fontSize: 14, marginBottom: 8 },
  hint: { color: C.faint, fontSize: 13, marginBottom: 10 },
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