import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Shadows_Into_Light, Short_Stack } from "next/font/google";
import "./globals.css";
import Header from "@/components/header";
import PushManager from "@/components/push-manager";
import BackNav from "@/components/back-nav";

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

const shortStack = Short_Stack({
  variable: "--font-short-stack",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Bullet Journal Logger",
  description: "Daily metrics logging with web push reminders",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BulletLogger",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* iOS PWA Support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BulletLogger" />
        <link rel="apple-touch-icon" href="/favicon.ico" />

        {/* Android PWA Support */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-navbutton-color" content="#000000" />
        <meta name="application-name" content="BulletLogger" />
        <meta name="color-scheme" content="light dark" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${journalScript.variable} ${shortStack.variable} doodle antialiased`}
      >
        <PushManager />
        <Header />
        <main className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pb-16 sm:pt-12 bujo-shell">
          <BackNav />
          {children}
        </main>
      </body>
    </html>
  );
}
