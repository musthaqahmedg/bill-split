import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from '../lib/brand';

export const metadata: Metadata = {
  title: `${BRAND.name} · Split bills, plan nights`,
  description: "Upload receipts, select items, and split bills with friends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </body>
    </html>
  );
}