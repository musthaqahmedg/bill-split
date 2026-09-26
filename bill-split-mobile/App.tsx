import { registerRootComponent } from 'expo';
import { useState } from 'react';
import BillDetailScreen from './screens/BillDetailScreen';
import HomeScreen from './screens/HomeScreen';
import ItemsScreen from './screens/ItemsScreen';
import LoginScreen from './screens/LoginScreen';
import PeopleScreen from './screens/PeopleScreen';
import RecheckScreen from './screens/RecheckScreen';
import SplitScreen from './screens/SplitScreen';
import UploadScreen from './screens/UploadScreen';

// After Recheck, find where each new item was in the old list (-1 = new item)
function matchItems(oldItems: any[], newItems: any[]) {
  const used = new Set();
  return newItems.map((it) => {
    const i = oldItems.findIndex((o, k) => !used.has(k) && o.name === it.name);
    if (i !== -1) used.add(i);
    return i;
  });
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [screen, setScreen] = useState('home');
  const [items, setItems] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [openBillId, setOpenBillId] = useState<any>(null);
  const [editingBillId, setEditingBillId] = useState<any>(null);

  const startNewBill = () => {
    setItems([]);
    setBill(null);
    setPeople([]);
    setClaims([]);
    setPayers([]);
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
          const map = matchItems(items, fixedItems);
          setClaims(map.map((i) => (i === -1 ? [] : claims[i] || [])));
          setPayers(map.map((i) => (i === -1 ? {} : payers[i] || {})));
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
          setPayers((old) =>
            items.map((_, i) =>
              Object.fromEntries(
                Object.entries(old[i] || {}).filter(
                  ([who, payer]) => names.includes(who) && names.includes(payer)
                )
              )
            )
          );
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
          // Drop sponsorships for anyone who no longer has that item
          setPayers((old) =>
            items.map((_, i) =>
              Object.fromEntries(
                Object.entries(old[i] || {}).filter(([who]) => (picked[i] || []).includes(who))
              )
            )
          );
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
        payers={payers}
        onPayersChange={setPayers}
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
          setPayers(flow.payers || flow.items.map(() => ({})));
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