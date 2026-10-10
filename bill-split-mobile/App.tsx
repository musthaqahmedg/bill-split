import { registerRootComponent } from 'expo';
import { useState } from 'react';
import BillDetailScreen from './screens/BillDetailScreen';
import HomeScreen from './screens/HomeScreen';
import ItemsScreen from './screens/ItemsScreen';
import LoginScreen from './screens/LoginScreen';
import PeopleScreen from './screens/PeopleScreen';
import ProfileScreen from './screens/ProfileScreen';
import RecheckScreen from './screens/RecheckScreen';
import SplitScreen from './screens/SplitScreen';
import UploadScreen from './screens/UploadScreen';
import { kindOf } from './services/kinds';
import { supabase } from './services/supabaseClient';

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
  const [pairs, setPairs] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [openBillId, setOpenBillId] = useState<any>(null);
  const [editingBillId, setEditingBillId] = useState<any>(null);
  const [addingRound, setAddingRound] = useState(false); // rolling tab: scanning another round

  const startNewBill = () => {
    setItems([]);
    setBill(null);
    setPeople([]);
    setNonDrinkers([]);
    setPairs([]);
    setClaims([]);
    setPayers([]);
    setEditingBillId(null);
    setAddingRound(false);
    setScreen('upload');
  };

  // Load a saved bill into the flow (used by Edit and Add a round)
  const loadBill = (flow: any, id: any) => {
    setItems(flow.items);
    setBill(flow.bill);
    setPeople(flow.people);
    setNonDrinkers(flow.nonDrinkers || []);
    setPairs([]);
    setClaims(flow.claims);
    setPayers(flow.payers || flow.items.map(() => ({})));
    setEditingBillId(id);
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

  // Pairs: the payer covers everything their partner had
  const applyPairs = (base: any[], newClaims: any[]) =>
    base.map((m, i) => {
      const out = { ...(m || {}) };
      pairs.forEach((pr: any) => {
        const partner = pr.payer === pr.a ? pr.b : pr.a;
        if ((newClaims[i] || []).includes(partner)) out[partner] = pr.payer;
      });
      return out;
    });

  // Log out properly (ends the Supabase session too)
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setLoggedIn(false);
    setScreen('home');
  };

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} />;
  }

  if (screen === 'upload') {
    return (
      <UploadScreen
        title={addingRound ? 'Add a round ➕' : 'Scan Receipt'}
        onBack={() => {
          if (addingRound) {
            setAddingRound(false);
            setScreen('detail');
          } else {
            setScreen('home');
          }
        }}
        onNext={(scanned: any, billInfo: any) => {
          if (addingRound) {
            // Rolling tab: add the new round's items to the same bill
            const add = (k: string) => (Number(bill?.[k]) || 0) + (Number(billInfo?.[k]) || 0);
            setItems([...items, ...scanned]);
            setClaims([...claims, ...scanned.map(() => [])]);
            setPayers([...payers, ...scanned.map(() => ({}))]);
            setBill({
              ...bill,
              total: add('total'),
              tax: add('tax'),
              service_charge: add('service_charge'),
              discount: add('discount'),
            });
            setAddingRound(false);
          } else {
            setItems(scanned);
            setBill(billInfo);
          }
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
        initialPairs={pairs}
        onBack={() => setScreen('recheck')}
        onNext={(names: any, dry: any = [], prs: any = []) => {
          // Remove people who left, and take non-drinkers off alcohol items
          const newClaims = items.map((it, i) =>
            (claims[i] || []).filter(
              (n: any) => names.includes(n) && !(kindOf(it) === 'alcohol' && dry.includes(n))
            )
          );
          setPeople(names);
          setNonDrinkers(dry);
          setPairs(prs);
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
          setPayers((old) => applyPairs(trimPayers(old, picked, people), picked));
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
        pairs={pairs}
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

  if (screen === 'profile') {
    return <ProfileScreen onBack={() => setScreen('home')} onLogout={logout} />;
  }

  if (screen === 'detail') {
    return (
      <BillDetailScreen
        billId={openBillId}
        onBack={() => setScreen('home')}
        onDeleted={() => setScreen('home')}
        onEdit={(flow: any, id: any) => {
          loadBill(flow, id);
          setScreen('recheck');
        }}
        onAddRound={(flow: any, id: any) => {
          loadBill(flow, id);
          setAddingRound(true);
          setScreen('upload');
        }}
      />
    );
  }

  return (
    <HomeScreen
      onNewBill={startNewBill}
      onLogout={logout}
      onProfile={() => setScreen('profile')}
      onOpenBill={(id: any) => {
        setOpenBillId(id);
        setScreen('detail');
      }}
    />
  );
}

registerRootComponent(App);