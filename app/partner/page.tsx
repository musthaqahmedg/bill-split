import type { Metadata } from 'next';
import Partner from './Partner';

export const metadata: Metadata = {
  title: 'Vibe Out for Restaurants',
  description: 'Your menu, table QR codes and live orders in one place.',
};

export default function PartnerPage() {
  return <Partner />;
}
