import type { Metadata } from 'next';
import DeleteAccount from './DeleteAccount';

export const metadata: Metadata = {
  title: 'Delete your account · Vibe Out',
  description: 'Delete your Vibe Out account and all your data.',
};

export default function Page() {
  return <DeleteAccount />;
}
