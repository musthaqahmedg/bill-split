import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy · Vibe Out' };

const CONTACT = 'maginfosystems@gmail.com';
const UPDATED = '13 October 2026';

export default function Privacy() {
  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <p style={s.kicker}>🌙 VIBE OUT</p>
        <h1 style={s.title}>Privacy Policy</h1>
        <p style={s.sub}>Last updated: {UPDATED}</p>

        <h2 style={s.h2}>What we collect</h2>
        <ul style={s.ul}>
          <li><b>Your email or phone number</b>, to log you in.</li>
          <li><b>Your name and UPI ID</b>, if you add them, so friends know who to pay.</li>
          <li><b>Your bills</b>: restaurant, items, prices, and the names of friends you add.</li>
          <li><b>Plans and parties</b> you create: place, date, budget, friends, the bring list, chat, polls, bookings and safe-night check-ins.</li>
          <li><b>App usage</b>: which screens you open and actions like creating a plan, so we can fix problems and improve the app.</li>
          <li><b>Notifications</b>: a push token for your phone, so we can send alerts like friend requests and chat messages. You can hide message previews in Profile, or turn notifications off in your phone’s settings.</li>
          <li><b>Help chat</b>: messages you send in “Chat with us”, so our team can reply. Only you and our team can see them.</li>
          <li><b>Your location</b>, only when you allow it, to show places near you. We don&apos;t store it.</li>
          <li><b>Bill photos</b> you scan. They are sent to Google Gemini to read the items, and we do not keep the photo.</li>
        </ul>

        <h2 style={s.h2}>How we use it</h2>
        <ul style={s.ul}>
          <li>Only to run the app: split bills, plan with friends, show who owes what, and help friends pay you.</li>
          <li>We <b>never sell</b> your data, and we show no ads based on it.</li>
        </ul>

        <h2 style={s.h2}>Shared links</h2>
        <p style={s.p}>
          When you share a bill link, anyone with that link can see that bill, the names on it, and your UPI ID.
          Only share it with the people at the table.
        </p>

        <h2 style={s.h2}>Where it is stored</h2>
        <p style={s.p}>
          Your data is stored securely with Supabase. Each person can only see their own bills inside the app.
        </p>

        <h2 style={s.h2}>Deleting your data</h2>
        <p style={s.p}>
          In the app, go to <b>Profile → Delete my account</b>. This permanently deletes your account and all your bills.
        </p>

        <h2 style={s.h2}>Children</h2>
        <p style={s.p}>The app is not meant for anyone under 18.</p>

        <h2 style={s.h2}>Contact us</h2>
        <p style={s.p}>Vibe Out is made by <b>MAG Infosystems</b>. Questions about your data? Write to us: <a href={`mailto:${CONTACT}`} style={s.link}>{CONTACT}</a></p>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#160A2B', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  wrap: { maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px', lineHeight: 1.6 },
  kicker: { color: '#C9A8FF', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, margin: 0 },
  title: { fontSize: 30, fontWeight: 800, margin: '8px 0 4px' },
  sub: { color: '#8C7AAE', fontSize: 14, margin: '0 0 24px' },
  h2: { fontSize: 18, fontWeight: 700, margin: '24px 0 8px', color: '#C9A8FF' },
  p: { color: '#E6DAFF', margin: 0 },
  ul: { color: '#E6DAFF', margin: 0, paddingLeft: 20 },
  link: { color: '#C9A8FF', fontWeight: 700 },
};