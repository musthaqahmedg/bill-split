import type { Metadata } from 'next';
import EventsAdmin from './EventsAdmin';
import { BRAND } from '../../../lib/brand';

export const metadata: Metadata = { title: `${BRAND.name} · Events admin`, robots: { index: false, follow: false } };

export default function EventsAdminPage() {
  return <EventsAdmin />;
}
