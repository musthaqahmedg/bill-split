import { registerRootComponent } from 'expo';
import { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import RecheckScreen from './screens/RecheckScreen';
import PeopleScreen from './screens/PeopleScreen';
import ItemsScreen from './screens/ItemsScreen';
import SplitScreen from './screens/SplitScreen';
import BillDetailScreen from './screens/BillDetailScreen';

// If items were changed on the Recheck screen, keep each item's "who had it" attached to the right item
function realignClaims(oldItems: any[], oldClaims: any[], newItems: any[]) {
  const used = new Set();
  return newItems.map((it) => {
    const i = oldItems.findIndex((o, k) => !used.has(k) && o.name === it.name);
    if (i === -1) return [];
    used.add(i);
    return oldClaims[i] || [];
  });
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState('home');
  const [items, setItems] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [openBillId, setOpenBillId] = useState<any>(null);
  const [editingBillId, setEditingBillId] = useState<any>(null);

  const startNewBill = () => {
    setItems([]);
    setBill(null);
    setPeople([]);
    setClaims([]);
    setEditingBillId(null);
    setScreen('upload');
  };

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (screen === 'upload') {
    return (
      <UploadScreen
        onBack={() => setScreen('home')}
        onNext={(scanned: any, billInfo: any) => {
          setItems(scanned);
          setBill(billInfo);
          setScreen('recheck');
        }}
      />
    );
  }

  if (screen === 'recheck') {
    return (
      <RecheckScreen
        items={items}
        bill={bill}
        onBack={() => setScreen(editingBillId ? 'detail' : 'upload')}
        onNext={(fixedItems: any, fixedBill: any) => {
          if (editingBillId) setClaims(realignClaims(items, claims, fixedItems));
          setItems(fixedItems);
          setBill(fixedBill);
          setScreen('people');
        }}
      />
    );
  }

  if (screen === 'people') {
    return (
      <PeopleScreen
        initialPeople={people}
        onBack={() => setScreen('recheck')}
        onNext={(names: any) => {
          setPeople(names);
          setClaims((old) => items.map((_, i) => (old[i] || []).filter((n: any) => names.includes(n))));
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
        initialClaims={claims}
        onBack={() => setScreen('people')}
        onNext={(picked: any) => {
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
        editingBillId={editingBillId}
        onBack={() => setScreen('items')}
        onDone={() => {
          setEditingBillId(null);
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'detail') {
    return (
      <BillDetailScreen
        billId={openBillId}
        onBack={() => setScreen('home')}
        onDeleted={() => setScreen('home')}
        onEdit={(flow: any, id: any) => {
          setItems(flow.items);
          setBill(flow.bill);
          setPeople(flow.people);
          setClaims(flow.claims);
          setEditingBillId(id);
          setScreen('recheck');
        }}
      />
    );
  }

  return (
    <HomeScreen
      onNewBill={startNewBill}
      onLogout={() => setLoggedIn(false)}
      onOpenBill={(id: any) => {
        setOpenBillId(id);
        setScreen('detail');
      }}
    />
  );
}

registerRootComponent(App);