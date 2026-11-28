import type { Metadata } from 'next';
import Partner from './Partner';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: `${BRAND.name} for Restaurants`,
  description: 'Your menu, table QR codes and live orders in one place.',
};

export default function PartnerPage() {
  return <Partner />;
}
