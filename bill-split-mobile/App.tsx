import { registerRootComponent } from 'expo';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, PanResponder, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BillDetailScreen from './screens/BillDetailScreen';
import GroupScreen from './screens/GroupScreen';
import GroupsScreen from './screens/GroupsScreen';
import FriendsScreen from './screens/FriendsScreen';
import NotificationBanner from './screens/NotificationBanner';
import BugSheet from './screens/BugSheet';
import TabBar from './screens/TabBar';
import BugBubble from './screens/BugBubble';
import { Accelerometer } from 'expo-sensors';
import HelpScreen from './screens/HelpScreen';
import SupportChatScreen from './screens/SupportChatScreen';
import SupportInbox from './screens/SupportInbox';
import BugListScreen from './screens/BugListScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import { setNotificationNavigator } from './services/notifications';
import HomeScreen from './screens/HomeScreen';
import { track } from './services/track';
import { crashScreen, crashUser, initCrash, wrapApp } from './services/crash';

initCrash();
import { startPresence } from './services/active';
import { listenPushTaps, registerPush, unregisterPush } from './services/push';
import ItemsScreen from './screens/ItemsScreen';
import LockScreen from './screens/LockScreen';
import LoginScreen from './screens/LoginScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import GuestGate from './screens/GuestGate';
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

function App({ onScreen, registerNav, onBug }: { onScreen?: (s: string) => void; registerNav?: (go: (s: string) => void) => void; onBug?: () => void }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true); // looking for a saved login
  const [welcomed, setWelcomed] = useState(true); // seen the welcome slides on this phone?
  const [guest, setGuest] = useState(false); // 👤 trying the app without an account
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setGuest(!!(session && session.user && (session.user as any).is_anonymous)));
    return () => data.subscription.unsubscribe();
  }, []);
  // 👋 Try first, sign up later: start as a guest straight from the welcome slides
  const startAsGuest = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return Alert.alert("Couldn't start", error.message);
    AsyncStorage.setItem('vibeout.welcomed', '1').catch(() => {});
    setWelcomed(true);
    setGuest(true);
    setLoggedIn(true);
  };
  const [locked, setLocked] = useState(false); // saved login found, waiting for Face ID
  const [screen, setScreen] = useState('home');
  // tell Root the page changed, so it can slide the new page in
  useEffect(() => {
    if (onScreen) onScreen(screen);
  }, [screen]);
  // let Root go back on a swipe from the left edge
  useEffect(() => {
    if (registerNav) registerNav((s: string) => setScreen(s));
  }, []);
  const [supportThread, setSupportThread] = useState<any>(null); // team: whose support chat is open
  const [friendsAdd, setFriendsAdd] = useState(false); // open Friends straight on "Add friends"
  // 🔔 tapping a notification opens the right screen (waits for login / Face ID if the app was closed)
  const ready = useRef(false);
  const pendingNotif = useRef<any>(null);
  const goNotif = useRef<(n: any) => void>(() => {});
  goNotif.current = (n: any) => {
      const d = (n && n.data) || {};
      if (d.bill_id) {
        setOpenBillId(d.bill_id);
        setScreen('detail');
      } else if (d.bugs || d.feedback_id) {
        setScreen('bugs');
      } else if (d.support) {
        setSupportThread(d.thread ? { userId: d.thread, name: ((n.title || '').replace('💬 ', '').replace(' needs help', '')) || 'Support' } : null);
        setScreen('support');
      } else if (d.friends) {
        setFriendsAdd(false);
        setScreen('friends');
      } else if (d.party_id) {
        setOpenPartyId(d.party_id);
        setScreen(d.chat ? 'partyChat' : 'party');
      } else setScreen('notifications');
  };
  useEffect(() => {
    setNotificationNavigator((n: any) => {
      if (!ready.current) pendingNotif.current = n;
      else goNotif.current(n);
    });
  }, []);
  // 🟢 tell friends you're active while the app is open
  useEffect(() => {
    if (loggedIn && !locked) return startPresence();
  }, [loggedIn, locked]);
  // 📱 lock-screen notifications: register this phone, and open the right page when one is tapped
  useEffect(() => {
    ready.current = loggedIn && !locked && !checking;
    if (loggedIn && !locked) registerPush();
    if (ready.current && pendingNotif.current) {
      const n = pendingNotif.current;
      pendingNotif.current = null;
      setTimeout(() => goNotif.current(n), 300);
    }
  }, [loggedIn, locked, checking]);
  useEffect(() => listenPushTaps(), []);
  // 📊 log each screen people open
  useEffect(() => {
    if (loggedIn && !locked) track(screen);
  }, [screen, loggedIn, locked]);
  const [items, setItems] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [nonDrinkers, setNonDrinkers] = useState<any[]>([]);
  const [pairs, setPairs] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [payment, setPayment] = useState<any>({ mode: 'me' }); // 💳 who paid the bill
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
    setPayment({ mode: 'me' });
    setEditingBillId(null);
    setAddingRound(false);
    setScreen('upload');
  };

  // 🏠 One tap home from the bill flow, with "Save as draft?" so nothing is lost
  const DRAFT_KEY = 'vibeout.billDraft';
  const [draft, setDraft] = useState<any>(null);
  const clearDraft = () => {
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    setDraft(null);
  };
  useEffect(() => {
    if (screen === 'home') {
      AsyncStorage.getItem(DRAFT_KEY)
        .then((d) => setDraft(d ? JSON.parse(d) : null))
        .catch(() => setDraft(null));
    }
  }, [screen]);
  const goHome = () => {
    if (!items.length) return setScreen('home');
    Alert.alert('Leave this bill?', 'Save it as a draft and finish it later from Home.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearDraft(); setScreen('home'); } },
      {
        text: '💾 Save draft',
        onPress: async () => {
          const d = { items, bill, people, nonDrinkers, pairs, claims, payers, payment, editingBillId, addingRound, screen, at: Date.now() };
          await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)).catch(() => {});
          setScreen('home');
        },
      },
    ]);
  };
  const resumeDraft = () => {
    if (!draft) return;
    setItems(draft.items || []);
    setBill(draft.bill || null);
    setPeople(draft.people || []);
    setNonDrinkers(draft.nonDrinkers || []);
    setPairs(draft.pairs || []);
    setClaims(draft.claims || []);
    setPayers(draft.payers || []);
    setPayment(draft.payment || { mode: 'me' });
    setEditingBillId(draft.editingBillId || null);
    setAddingRound(!!draft.addingRound);
    setScreen(draft.screen && draft.screen !== 'upload' ? draft.screen : 'recheck');
    clearDraft();
  };
  const withHome = (el: any) => (
    <View style={{ flex: 1 }}>
      {el}
      <TouchableOpacity
        onPress={goHome}
        hitSlop={10}
        style={{ position: 'absolute', top: 54, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 18 }}>🏠</Text>
      </TouchableOpacity>
    </View>
  );

  // Load a saved bill into the flow (used by Edit and Add a round)
  const loadBill = (flow: any, id: any) => {
    setItems(flow.items);
    setBill(flow.bill);
    setPeople(flow.people);
    setNonDrinkers(flow.nonDrinkers || []);
    setPairs([]);
    setClaims(flow.claims);
    setPayers(flow.payers || flow.items.map(() => ({})));
    setPayment(flow.payment || { mode: 'me' });
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
      .then(async ({ data }) => {
        const anon = !!(data.session && (data.session.user as any).is_anonymous);
        if (anon) {
          setGuest(true);
          setLoggedIn(true); // guests skip Face ID (nothing personal to protect yet)
        } else if (data.session) setLocked(true);
        else {
          const seen = await AsyncStorage.getItem('vibeout.welcomed').catch(() => null);
          setWelcomed(!!seen);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  // Ask for Face ID straight away when the lock screen appears
  useEffect(() => {
    if (locked) unlock();
  }, [locked]);

  // Log out properly (ends the Supabase session too)
  const logout = async () => {
    if (guest) {
      const ok = await new Promise((res) =>
        Alert.alert('Leave guest mode?', "Your bills and plans are only saved to this guest account. Save your account first so you don't lose them.", [
          { text: 'Save account', onPress: () => { setScreen('saveAccount'); res(false); } },
          { text: 'Log out anyway', style: 'destructive', onPress: () => res(true) },
          { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
        ])
      );
      if (!ok) return;
    }
    await unregisterPush();
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
    if (!welcomed) {
      return (
        <WelcomeScreen
          onGuest={startAsGuest}
          onSignIn={() => {
            AsyncStorage.setItem('vibeout.welcomed', '1').catch(() => {});
            setWelcomed(true);
          }}
        />
      );
    }
    return <LoginScreen onLoginSuccess={() => setLoggedIn(true)} onBack={() => setWelcomed(false)} />;
  }

  // 📱 Main pages get the bottom tabs; everything else (bill flow, chats, details) stays full screen
  const TAB_PAGES = ['home', 'parties', 'friends', 'profile'];
  const page = renderPage();
  if (!TAB_PAGES.includes(screen)) return page;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>{page}</View>
      <TabBar
        current={screen}
        onTab={(t: string) => {
          if (t === 'friends') setFriendsAdd(false);
          setScreen(t);
        }}
        onPlan={() => {
          setPlanGroup(null);
          setEditPlan(null);
          setScreen('newParty');
        }}
        onBill={startNewBill}
      />
    </View>
  );

  function renderPage() {
  if (screen === 'upload') {
    return withHome(
      <UploadScreen
        title={addingRound ? 'Add a round ➕' : 'Scan the bill 🧾'}
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
    return withHome(
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
    return withHome(
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
    return withHome(
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
    return withHome(
      <SplitScreen
        items={items}
        people={people}
        nonDrinkers={nonDrinkers}
        pairs={pairs}
        claims={claims}
        payers={payers}
        onPayersChange={setPayers}
        payment={payment}
        onPaymentChange={setPayment}
        bill={bill}
        editingBillId={editingBillId}
        onBack={() => setScreen('items')}
        onDone={() => {
          setEditingBillId(null);
          clearDraft();
          setScreen('home');
        }}
      />
    );
  }

  if (screen === 'profile') {
    return <ProfileScreen guest={guest} onSaveAccount={() => setScreen('saveAccount')} onBug={onBug} onLogout={logout} onHelp={() => setScreen('help')} />;
  }

  // 🔒 A guest saving their account (everything they made stays)
  if (screen === 'saveAccount') {
    return (
      <LoginScreen
        linking
        onBack={() => setScreen('home')}
        onLoginSuccess={() => {
          setGuest(false);
          setScreen('home');
          Alert.alert('Account saved 🎉', 'Your bills and plans are safe. You can add friends now.');
        }}
      />
    );
  }

  if (screen === 'help') {
    return (
      <HelpScreen
        onBack={() => setScreen('profile')}
        onChat={() => {
          setSupportThread(null);
          setScreen('support');
        }}
        onInbox={() => setScreen('supportInbox')}
        onBugs={() => setScreen('bugs')}
      />
    );
  }

  if (screen === 'bugs') {
    return <BugListScreen onBack={() => setScreen('help')} />;
  }

  if (screen === 'support') {
    return <SupportChatScreen key={supportThread ? supportThread.userId : 'me'} thread={supportThread} onBack={() => setScreen(supportThread ? 'supportInbox' : 'help')} />;
  }

  if (screen === 'supportInbox') {
    return (
      <SupportInbox
        onBack={() => setScreen('help')}
        onOpen={(t: any) => {
          setSupportThread(t);
          setScreen('support');
        }}
      />
    );
  }

  if (screen === 'parties') {
    return (
      <PartiesScreen
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
        onSplit={(names: any[]) => {
          startNewBill(); // 🌙 Night Mode → split the bill with tonight's crew already added
          setPeople(names && names.length ? names : ['Me']);
        }}
        onTakeOut={(p: any) => {
          setNearby({ from: 'party', category: 'food', title: '🍽️ Take the group out', bookFor: p });
          setScreen('nearby');
        }}
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
        bookFor={nearby.bookFor}
        onBooked={() => nearby.bookFor && setScreen('party')}
        onBack={() => setScreen(nearby.from)}
      />
    );
  }

  if (screen === 'notifications') {
    return <NotificationsScreen onBack={() => setScreen('home')} />;
  }

  if (screen === 'friends') {
    if (guest) return <GuestGate emoji="👥" title="Add your friends" body="Save your account so friends can find you, see who's out tonight and get birthday reminders." onSave={() => setScreen('saveAccount')} />;
    return (
      <FriendsScreen
        startAdding={friendsAdd}
        onOpenPlan={(id: any) => {
          setOpenPartyId(id);
          setScreen('party');
        }}
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
        onEdit={(flow: any, id: any, start?: string) => {
          loadBill(flow, id);
          setScreen(start || 'recheck'); // 🙋 reviewing friends' picks jumps straight to "Who had what?"
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
      guest={guest}
      onSaveAccount={() => setScreen('saveAccount')}
      draft={draft}
      onResumeDraft={resumeDraft}
      onDiscardDraft={clearDraft}
      onNewBill={startNewBill}
      onLogout={logout}
      onProfile={() => setScreen('profile')}
      onParties={() => setScreen('parties')}
      onNotifications={() => setScreen('notifications')}
      onFriends={(add: boolean) => {
        setFriendsAdd(!!add);
        setScreen('friends');
      }}
      onOpenBill={(id: any) => {
        setOpenBillId(id);
        setScreen('detail');
      }}
    />
  );
  }
}

// Whole app + the notification banner that slides over any screen
function Root() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session ? data.session.user.id : null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUid(session ? session.user.id : null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => crashUser(uid), [uid]);

  // ✨ Smooth page changes: forward slides in from the right, back from the left (like iPhone)
  const x = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const history = useRef<string[]>([]);
  const onScreen = (next: string) => {
    crashScreen(next);
    const h = history.current;
    if (!h.length) {
      h.push(next);
      return;
    }
    const back = h.length > 1 && h[h.length - 2] === next;
    if (back) h.pop();
    else {
      const i = h.lastIndexOf(next);
      if (i >= 0) h.splice(i + 1);
      else h.push(next);
    }
    const w = Dimensions.get('window').width;
    x.setValue((back ? -1 : 1) * w * 0.25);
    fade.setValue(0.4);
    Animated.parallel([
      Animated.timing(x, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  // 📳 Shake the phone anywhere → bug note (with the page you're on)
  const [bug, setBug] = useState(false);
  // 🐞 Testers (us + beta testers) also get a floating bug bubble they can drag anywhere
  const [tester, setTester] = useState(false);
  useEffect(() => {
    if (!uid) return setTester(false);
    supabase.rpc('is_tester').then(({ data }) => setTester(!!data), () => setTester(false));
  }, [uid]);
  const bugOpen = useRef(false);
  bugOpen.current = bug;
  useEffect(() => {
    if (!uid) return;
    let last = 0;
    let sub: any = null;
    try {
      Accelerometer.setUpdateInterval(120);
      sub = Accelerometer.addListener(({ x: ax, y: ay, z: az }) => {
        const g = Math.sqrt(ax * ax + ay * ay + az * az);
        const now = Date.now();
        if (g > 2.4 && now - last > 4000 && !bugOpen.current) {
          last = now;
          setBug(true);
        }
      });
    } catch (e) {}
    return () => sub && sub.remove();
  }, [uid]);

  // 👈 Swipe from the left edge to go back (the page follows your finger)
  const nav = useRef<((s: string) => void) | null>(null);
  const NO_BACK = ['home'];
  const edge = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const h = history.current;
        return h.length > 1 && !NO_BACK.includes(h[h.length - 1]);
      },
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 8 && Math.abs(g.dy) < Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        x.setValue(Math.max(0, g.dx));
        fade.setValue(1 - Math.min(0.4, g.dx / 800));
      },
      onPanResponderRelease: (_e, g) => {
        const w = Dimensions.get('window').width;
        const h = history.current;
        if ((g.dx > w * 0.3 || g.vx > 0.6) && h.length > 1 && nav.current) {
          // skip a finished "new plan" form when going back from the plan it created
          let k = h.length - 2;
          if (h[k] === 'newParty' && k > 0) {
            h.splice(k, 1);
            k -= 1;
          }
          Animated.timing(x, { toValue: w, duration: 160, useNativeDriver: true }).start(() => {
            if (nav.current) nav.current(h[k]);
          });
        } else {
          Animated.parallel([
            Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 8 }),
            Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        fade.setValue(1);
      },
    })
  ).current;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateX: x }] }}>
        <App onScreen={onScreen} registerNav={(go) => (nav.current = go)} onBug={() => setBug(true)} />
      </Animated.View>
      <View {...edge.panHandlers} style={{ position: 'absolute', left: 0, top: 90, bottom: 0, width: 22 }} />
      <NotificationBanner key={uid || 'none'} enabled={!!uid} />
      {tester ? <BugBubble onPress={() => setBug(true)} /> : null}
      <BugSheet visible={bug} onClose={() => setBug(false)} screen={history.current[history.current.length - 1]} />
    </View>
  );
}

const VibeOut = wrapApp(Root);
export default VibeOut;
registerRootComponent(VibeOut);