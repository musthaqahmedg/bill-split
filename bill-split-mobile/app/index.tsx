import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import { supabase } from '../services/supabaseClient';

export default function Index() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={() => setUser(true)} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Welcome! You are logged in.</Text>
    </View>
  );
}
