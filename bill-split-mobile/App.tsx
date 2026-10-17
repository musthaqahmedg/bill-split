import { registerRootComponent } from 'expo';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import BillDetailScreen from './screens/BillDetailScreen';
import GroupScreen from './screens/GroupScreen';
import GroupsScreen from './screens/GroupsScreen';
import HomeScreen from './screens/HomeScreen';
import ItemsScreen from './screens/ItemsScreen';
import LockScreen from './screens/LockScreen';
import LoginScreen from './screens/LoginScreen';
import NewPartyScreen from './screens/NewPartyScreen';
import PartiesScreen from './screens/PartiesScreen';
import PartyChatScreen from './screens/PartyChatScreen';
import PartyScreen from './screens/PartyScreen';
import PeopleScreen from './screens/PeopleScreen';
import ProfileScreen from './screens/ProfileScreen';
import RecheckScreen from './screens/RecheckScreen';
import NearbyScreen from './screens/NearbyScreen';
import SplitScreen from './screens/SplitScreen';
import UploadScreen from './screens/UploadScreen';
import { kindOf } from './services/kinds';
import { supabase } from './services/supabaseClient';
import { C } from './services/theme';

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
  const [checking, setChecking] = useState(true); // looking for a saved login
  const [locked, setLocked] = useState(false); // saved login found, waiting for Face ID
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
  const [openPartyId, setOpenPartyId] = useState<any>(null);
  const [openGroupId, setOpenGroupId] = useState<any>(null);
  const [planGroup, setPlanGroup] = useState<any>(null); // planning for a group (everyone pre-added)
  const [editPlan, setEditPlan] = useState<any>(null); // a plan being edited
  const [nearby, setNearby] = useState<any>({ from: 'parties', category: 'restobars', title: null }); // 📍 Nearby screen

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

  // Face ID first; the phone passcode if Face ID fails.
  // If this phone can't do Face ID / passcode at all (or Expo Go blocks it), just let them in.
  const unlock = async () => {
    const letIn = () => {
      setLocked(false);
      setLoggedIn(true);
    };
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) return letIn();
      const result: any = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Vibe Out',
        fallbackLabel: 'Use passcode',
      });
      if (result.success) return letIn();
      console.log('Unlock result:', result);
      // Only stay locked if the person cancelled or the face didn't match
      const stayLocked = ['user_cancel', 'system_cancel', 'app_cancel', 'authentication_failed', 'lockout'];
      if (!stayLocked.includes(result.error)) letIn();
    } catch (e) {
      letIn();
    }
  };

  // When the app opens: already logged in on this phone? Ask for Face ID instead of a code.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) setLocked(true);
      })
      .finally(() => setChecking(false));
  }, []);

  // Ask for Face ID straight away when the lock screen appears
  useEffect(() => {
    if (locked) unlock();
  }, [locked]);

  // Log out properly (ends the Supabase session too)
  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setLoggedIn(false);
    setScreen('home');
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.accentSoft} />
      </View>
    );
  }

  if (locked) {
    return (
      <LockScreen
        onUnlock={unlock}
        onUseAnother={() => {
          setLocked(false);
          setLoggedIn(false);
          supabase.auth.signOut().catch(() => {});
        }}
      />
    );
  }

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

  if (screen === 'parties') {
    return (
      <PartiesScreen
        onBack={() => setScreen('home')}
        onNewParty={() => {
          setPlanGroup(null);
          setEditPlan(null);
          setScreen('newParty');
        }}
        onGroups={() => setScreen('groups')}
        onNearby={() => {
          setNearby({ from: 'parties', category: 'restobars', title: null });
          setScreen('nearby');
        }}
        onOpenParty={(id: any) => {
          setOpenPartyId(id);
          setScreen('party');
        }}
      />
    );
  }

  if (screen === 'groups') {
    return (
      <GroupsScreen
        onBack={() => setScreen('parties')}
        onOpenGroup={(id: any) => {
          setOpenGroupId(id);
          setScreen('group');
        }}
      />
    );
  }

  if (screen === 'group') {
    return (
      <GroupScreen
        groupId={openGroupId}
        onBack={() => setScreen('groups')}
        onDeleted={() => setScreen('groups')}
        onPlan={(g: any) => {
          setEditPlan(null);
          setPlanGroup(g);
          setScreen('newParty');
        }}
        onOpenPlan={(id: any) => {
          setOpenPartyId(id);
          setScreen('party');
        }}
      />
    );
  }

  if (screen === 'newParty') {
    return (
      <NewPartyScreen
        key={editPlan ? `edit-${editPlan.id}` : 'new'}
        group={editPlan ? null : planGroup}
        editing={editPlan}
        onBack={() => setScreen(editPlan ? 'party' : planGroup ? 'group' : 'parties')}
        onCreated={(id: any) => {
          setOpenPartyId(id);
          setScreen('party');
        }}
      />
    );
  }

  if (screen === 'party') {
    return (
      <PartyScreen
        partyId={openPartyId}
        onBack={() => setScreen('parties')}
        onDeleted={() => setScreen('parties')}
        onChat={() => setScreen('partyChat')}
        onShop={() => {
          setNearby({ from: 'party', category: 'supermarkets', title: '🛒 Shop for this party' });
          setScreen('nearby');
        }}
        onEdit={(p: any) => {
          setEditPlan(p);
          setScreen('newParty');
        }}
      />
    );
  }

  if (screen === 'nearby') {
    return (
      <NearbyScreen
        initialCategory={nearby.category}
        title={nearby.title}
        onBack={() => setScreen(nearby.from)}
      />
    );
  }

  if (screen === 'partyChat') {
    return <PartyChatScreen partyId={openPartyId} onBack={() => setScreen('party')} />;
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
      onParties={() => setScreen('parties')}
      onOpenBill={(id: any) => {
        setOpenBillId(id);
        setScreen('detail');
      }}
    />
  );
}

registerRootComponent(App);