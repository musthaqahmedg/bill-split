import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';

export default function LoginScreen({ onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setShowOtp(true);
      Alert.alert('Success', 'OTP sent to your phone');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter OTP');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      onLoginSuccess();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bill Split</Text>
      <Text style={styles.subtitle}>Login with Phone</Text>
      {!showOtp ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            value={phone}
            onChangeText={setPhone}
            editable={!loading}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
            <Text style={styles.buttonText}>Send OTP</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChangeText={setOtp}
            editable={!loading}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
            <Text style={styles.buttonText}>Verify OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowOtp(false); setOtp(''); }}>
            <Text style={styles.link}>Back to phone number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, marginBottom: 15, borderRadius: 8, fontSize: 16 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { color: '#007AFF', textAlign: 'center', marginTop: 15 },
});
