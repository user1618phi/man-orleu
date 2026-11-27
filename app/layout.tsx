import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

const sans = localFont({
  src: "./fonts/MedeoSansVariable.woff2",
  variable: "--font-medeo-sans",
  weight: "100 900",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/MedeoMonoVariable.woff2",
  variable: "--font-medeo-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Мән",
  description: "Офлайн-тренажёр математической грамотности для 7–9 классов",
  appleWebApp: { capable: true, title: "Мән", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="kk" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
