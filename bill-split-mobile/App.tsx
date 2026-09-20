import { registerRootComponent } from 'expo';
import { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <HomeScreen
      onNewBill={() => {}}
      onLogout={() => setLoggedIn(false)}
    />
  );
}

registerRootComponent(App);