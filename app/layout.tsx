import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-inter",
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
  themeColor: "#f6f3fa",
  colorScheme: "light",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="kk" className={inter.variable}>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
