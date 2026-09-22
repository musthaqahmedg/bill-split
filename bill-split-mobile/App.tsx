import { registerRootComponent } from 'expo';
import { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import PeopleScreen from './screens/PeopleScreen';
import ItemsScreen from './screens/ItemsScreen';
import SplitScreen from './screens/SplitScreen';
import BillDetailScreen from './screens/BillDetailScreen';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState('home');
  const [items, setItems] = useState([]);
  const [bill, setBill] = useState(null);
  const [people, setPeople] = useState([]);
  const [claims, setClaims] = useState([]);
  const [openBillId, setOpenBillId] = useState(null);

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (screen === 'upload') {
    return (
      <UploadScreen
        onBack={() => setScreen('home')}
        onNext={(scanned, billInfo) => {
          setItems(scanned);
          setBill(billInfo);
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
          setScreen('items');
        }}
      />
    );
  }

  if (screen === 'items') {
    return (
      <ItemsScreen
        items={items}
        people={people}
        onBack={() => setScreen('people')}
        onNext={(picked) => {
          setClaims(picked);
          setScreen('split');
        }}
      />
    );
  }

  if (screen === 'split') {
    return (
      <SplitScreen
        items={items}
        people={people}
        claims={claims}
        bill={bill}
        onBack={() => setScreen('items')}
        onDone={() => setScreen('home')}
      />
    );
  }

  if (screen === 'detail') {
    return (
      <BillDetailScreen
        billId={openBillId}
        onBack={() => setScreen('home')}
        onDeleted={() => setScreen('home')}
      />
    );
  }

  return (
    <HomeScreen
      onNewBill={() => setScreen('upload')}
      onLogout={() => setLoggedIn(false)}
      onOpenBill={(id) => {
        setOpenBillId(id);
        setScreen('detail');
      }}
    />
  );
}

registerRootComponent(App);