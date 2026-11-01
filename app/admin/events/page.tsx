import type { Metadata } from 'next';
import EventsAdmin from './EventsAdmin';

export const metadata: Metadata = { title: 'Vibe Out · Events admin', robots: { index: false, follow: false } };

export default function EventsAdminPage() {
  return <EventsAdmin />;
}
