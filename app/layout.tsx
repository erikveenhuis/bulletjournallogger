import type { Metadata } from "next";
import { Geist, Geist_Mono, Shadows_Into_Light } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const journalScript = Shadows_Into_Light({
  variable: "--font-bujo-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Bullet Journal Logger",
  description: "Daily metrics logging with web push reminders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${journalScript.variable} antialiased`}
      >
        <Header />
        <main className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pb-16 sm:pt-12 bujo-shell">
          {children}
        </main>
      </body>
    </html>
  );
}
