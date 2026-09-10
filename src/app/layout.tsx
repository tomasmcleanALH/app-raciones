import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Operaciones",
  description: "Registro de entregas de alimento a las recrías",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-las-helenas.jpg",
    apple: "/logo-las-helenas.jpg",
  },
};

export const viewport: Viewport = {
  themeColor: "#641f38",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
