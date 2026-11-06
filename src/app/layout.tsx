import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { AuthGate } from "@/components/profile/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Pockets", template: "%s · Pockets" },
  description: "Cuánto debes y cuánto tienes libre de verdad, entre tus bolsas y tu tarjeta.",
  // Lets the iPhone open it full screen, like an app, once added to the home screen.
  appleWebApp: { capable: true, title: "Pockets", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} antialiased`}>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
