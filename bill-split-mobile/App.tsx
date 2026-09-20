import { registerRootComponent } from 'expo';
import { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import UploadScreen from './screens/UploadScreen';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState('home');

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (screen === 'upload') {
    return <UploadScreen onBack={() => setScreen('home')} />;
  }

  return (
    <HomeScreen
      onNewBill={() => setScreen('upload')}
      onLogout={() => setLoggedIn(false)}
    />
  );
}

registerRootComponent(App);