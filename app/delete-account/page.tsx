import type { Metadata } from 'next';
import DeleteAccount from './DeleteAccount';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: `Delete your account · ${BRAND.name}`,
  description: `Delete your ${BRAND.name} account and all your data.`,
};

export default function Page() {
  return <DeleteAccount />;
}
