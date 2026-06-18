import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UAE Flight Compensation",
  description:
    "Check your eligibility for UAE GCAA flight compensation and duty of care entitlements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
