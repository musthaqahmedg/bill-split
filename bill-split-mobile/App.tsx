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
import { kindOf } from './services/kinds';

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
  const [nonDrinkers, setNonDrinkers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [openBillId, setOpenBillId] = useState<any>(null);
  const [editingBillId, setEditingBillId] = useState<any>(null);

  const startNewBill = () => {
    setItems([]);
    setBill(null);
    setPeople([]);
    setNonDrinkers([]);
    setClaims([]);
    setPayers([]);
    setEditingBillId(null);
    setScreen('upload');
  };

  // Keep sponsorships only for people still on each item
  const trimPayers = (old: any[], newClaims: any[], names: any[]) =>
    items.map((_, i) =>
      Object.fromEntries(
        Object.entries(old[i] || {}).filter(
          ([who, payer]) => (newClaims[i] || []).includes(who) && names.includes(payer)
        )
      )
    );

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
        initialNonDrinkers={nonDrinkers}
        onBack={() => setScreen('recheck')}
        onNext={(names: any, dry: any = []) => {
          // Remove people who left, and take non-drinkers off alcohol items
          const newClaims = items.map((it, i) =>
            (claims[i] || []).filter(
              (n: any) => names.includes(n) && !(kindOf(it) === 'alcohol' && dry.includes(n))
            )
          );
          setPeople(names);
          setNonDrinkers(dry);
          setClaims(newClaims);
          setPayers((old) => trimPayers(old, newClaims, names));
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
        initialNonDrinkers={nonDrinkers}
        onBack={() => setScreen('people')}
        onNext={(picked: any, dry: any) => {
          if (dry) setNonDrinkers(dry);
          setClaims(picked);
          setPayers((old) => trimPayers(old, picked, people));
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
        nonDrinkers={nonDrinkers}
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
          setNonDrinkers(flow.nonDrinkers || []);
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