import { LinearGradient } from '../components/SafeGradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { supabase } from '../services/supabaseClient';
import KeyboardDone, { DONE_ID } from './KeyboardDone';
import { C, F, G } from '../services/theme';

// Accepts "8606670896", "918606670896" or "+918606670896" → "+918606670896"
const toE164 = (raw) => {
  const s = raw.replace(/[\s-]/g, '');
  if (s.startsWith('+')) return s;
  if (/^\d{10}$/.test(s)) return '+91' + s;
  if (/^91\d{10}$/.test(s)) return '+' + s;
  return s;
};

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// linking = a guest saving their account: same screen, but the code is attached to the guest account so nothing is lost
export default function LoginScreen({ onLoginSuccess, onBack, onGuest, linking: linkingProp = false }) {
  const [guestBusy, setGuestBusy] = useState(false);
  const [linking, setLinking] = useState(linkingProp);
  const [method, setMethod] = useState('email'); // 'email' (free code by email) or 'phone' (test numbers)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [lastEmail, setLastEmail] = useState(''); // the email used last time on this phone

  // Remember the last email, so next time it's one tap instead of typing
  useEffect(() => {
    AsyncStorage.getItem('lastEmail').then((e) => e && setLastEmail(e)).catch(() => {});
  }, []);

  const cleanEmail = email.trim().toLowerCase();

  const handleSendOtp = async (override) => {
    const useEmail = typeof override === 'string' ? override : cleanEmail;
    if (typeof override === 'string') {
      setMethod('email');
      setEmail(override);
    }
    if (method === 'email' && !isEmail(useEmail) && typeof override !== 'string') {
      Alert.alert('Email needed', 'Please enter a valid email address');
      return;
    }
    if (method === 'phone' && !phone.trim()) {
      Alert.alert('Phone number needed', 'Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const target = typeof override === 'string' || method === 'email' ? { email: useEmail } : { phone: toE164(phone) };
      const { error } = linking ? await supabase.auth.updateUser(target) : await supabase.auth.signInWithOtp(target);
      if (error) {
        // That email/number already has an account → sign in to it instead
        if (linking && /already|registered|exists/i.test(error.message)) {
          setLoading(false);
          return Alert.alert('You already have an account', 'Sign in to it instead? Bills you made as a guest stay on the guest account.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign in',
              onPress: async () => {
                setLinking(false);
                const { error: e2 } = await supabase.auth.signInWithOtp(target);
                if (e2) Alert.alert("Couldn't send the code", e2.message);
                else setShowOtp(true);
              },
            },
          ]);
        }
        throw error;
      }
      if (showOtp) Alert.alert('Sent again 📩', 'Check your inbox (and spam) for the new code');
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
          ? { email: cleanEmail, token: otp.trim(), type: linking ? 'email_change' : 'email' }
          : { phone: toE164(phone), token: otp.trim(), type: linking ? 'phone_change' : 'sms' }
      );
      if (error) throw error;
      if (method === 'email') AsyncStorage.setItem('lastEmail', cleanEmail).catch(() => {});
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
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.logo}>{linking ? '🔒' : '🌙'}</Text>
      <Text style={styles.title}>{linking ? 'Save your account' : 'Vibe Out'}</Text>
      <Text style={styles.subtitle}>{linking ? 'Keep your bills and plans safe, and add friends' : 'The night, sorted ✨'}</Text>

      {!showOtp ? (
        <>
          {method === 'email' && lastEmail && !linking ? (
            <TouchableOpacity style={styles.quick} onPress={() => handleSendOtp(lastEmail)} disabled={loading}>
              <Text style={styles.quickTitle}>Continue as</Text>
              <Text style={styles.quickEmail}>{lastEmail}</Text>
            </TouchableOpacity>
          ) : null}

          {method === 'email' ? (
            <>
              <Text style={styles.label}>{lastEmail ? 'Or use another email' : 'Your email'}</Text>
              <TextInput
          inputAccessoryViewID={DONE_ID}
                style={styles.input}
                placeholder="you@gmail.com"
                placeholderTextColor={C.faint}
                keyboardAppearance="dark"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
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
          inputAccessoryViewID={DONE_ID}
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
            <LinearGradient colors={G.hot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => switchMethod(method === 'email' ? 'phone' : 'email')}>
            <Text style={styles.link}>
              {method === 'email' ? 'Use phone number instead' : 'Use email instead'}
            </Text>
          </TouchableOpacity>

          {onGuest && !linking ? (
            <>
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>
              <TouchableOpacity
                style={styles.guestBtn}
                disabled={guestBusy}
                onPress={async () => {
                  setGuestBusy(true);
                  try {
                    await onGuest();
                  } finally {
                    setGuestBusy(false);
                  }
                }}
              >
                {guestBusy ? (
                  <ActivityIndicator color={C.text} />
                ) : (
                  <>
                    <Text style={styles.guestTitle}>👀 Continue as guest</Text>
                    <Text style={styles.guestSub}>No sign-up needed. Save your account later.</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : null}
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
          inputAccessoryViewID={DONE_ID}
            style={[styles.input, styles.otpInput]}
            placeholder="••••••"
            placeholderTextColor={C.faint}
            keyboardAppearance="dark"
            value={otp}
            onChangeText={setOtp}
            editable={!loading}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
            <LinearGradient colors={G.hot} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Let's go</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
            <Text style={styles.link}>Didn't get it? Send again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowOtp(false); setOtp(''); }}>
            <Text style={styles.link}>{method === 'email' ? 'Change email' : 'Change number'}</Text>
          </TouchableOpacity>
        </>
      )}
      <Text style={styles.trust}>🔒 We only use this to log you in. No spam, no contact syncing.</Text>
      <KeyboardDone />
    </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: C.bg },
  backBtn: { position: 'absolute', top: 60, left: 24 },
  back: { color: C.accentSoft, fontSize: 17 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { color: C.faint, fontSize: 13, marginHorizontal: 12 },
  guestBtn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, alignItems: 'center', marginTop: 18 },
  guestTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  guestSub: { color: C.faint, fontSize: 12, marginTop: 3 },
  trust: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontFamily: F.display, fontSize: 30, textAlign: 'center', color: C.text, marginTop: 8 },
  subtitle: { fontSize: 16, color: C.accentSoft, marginTop: 6, marginBottom: 40, textAlign: 'center' },
  label: { color: C.sub, fontSize: 14, marginBottom: 8 },
  quick: { backgroundColor: C.cardHi, borderWidth: 1, borderColor: C.accent, borderRadius: 14, padding: 16, marginBottom: 20, alignItems: 'center' },
  quickTitle: { color: C.sub, fontSize: 13 },
  quickEmail: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  hint: { color: C.faint, fontSize: 13, marginBottom: 10 },
  phoneRow: { flexDirection: 'row' },
  code: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', marginRight: 10, marginBottom: 15 },
  codeText: { color: C.text, fontSize: 16, fontWeight: '600' },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, padding: 15, marginBottom: 15, borderRadius: 14, fontSize: 17, color: C.text },
  phoneInput: { flex: 1 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 6, overflow: 'hidden' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  link: { color: C.accentSoft, textAlign: 'center', marginTop: 18, fontSize: 15 },
});