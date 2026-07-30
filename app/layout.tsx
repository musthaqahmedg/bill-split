import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bill Split - Split receipts easily",
  description: "Upload receipts, select items, and split bills with friends",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
