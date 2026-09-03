import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BorderShield AI",
  description: "AI-Powered Identity & Document Screening for Secure Borders",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
