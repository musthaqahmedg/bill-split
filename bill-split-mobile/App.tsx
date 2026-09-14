import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';
import LoginScreen from './screens/LoginScreen';

export default function App() {
  return <LoginScreen onLoginSuccess={() => Alert.alert('Logged in!')} />;
}

registerRootComponent(App);