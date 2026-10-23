import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkillLens",
  description: "A 10-minute level-up challenge at the end of a P2E course",
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
