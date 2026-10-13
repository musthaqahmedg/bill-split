import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../services/theme';

// Shown when the app opens and you're already logged in: unlock with Face ID
export default function LockScreen({ onUnlock, onUseAnother }) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🌙</Text>
      <Text style={styles.title}>Vibe Out</Text>
      <Text style={styles.subtitle}>Welcome back ✨</Text>
      <TouchableOpacity style={styles.button} onPress={onUnlock}>
        <Text style={styles.buttonText}>🔓 Unlock with Face ID</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onUseAnother}>
        <Text style={styles.link}>Log in with another account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: C.bg },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 38, fontWeight: '800', textAlign: 'center', color: C.text, marginTop: 8 },
  subtitle: { fontSize: 16, color: C.accentSoft, marginTop: 6, marginBottom: 40, textAlign: 'center' },
  button: { backgroundColor: C.accent, padding: 16, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  link: { color: C.accentSoft, textAlign: 'center', marginTop: 18, fontSize: 15 },
});