import { registerRootComponent } from 'expo';
import { useState } from 'react';
import { Alert } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import PeopleScreen from './screens/PeopleScreen';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState('home');
  const [items, setItems] = useState([]);
  const [people, setPeople] = useState([]);

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (screen === 'upload') {
    return (
      <UploadScreen
        onBack={() => setScreen('home')}
        onNext={(scanned) => {
          setItems(scanned);
          setScreen('people');
        }}
      />
    );
  }

  if (screen === 'people') {
    return (
      <PeopleScreen
        onBack={() => setScreen('upload')}
        onNext={(names) => {
          setPeople(names);
          Alert.alert('Ready!', `${items.length} items, ${names.length} people. Item selection comes next.`);
        }}
      />
    );
  }

  return (
    <HomeScreen
      onNewBill={() => setScreen('upload')}
      onLogout={() => setLoggedIn(false)}
    />
  );
}

registerRootComponent(App);