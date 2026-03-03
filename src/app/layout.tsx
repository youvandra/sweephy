import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const neueRegrade = localFont({
  src: "./fonts/NeueRegradeVariable.ttf",
  variable: "--font-neue-regrade",
  weight: "100 900",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sweephy - 1-Tap Swap for ESP32",
  description: "Secure production-ready crypto swap platform for desktop devices",
};

import { Web3ModalProvider } from "@/lib/web3-provider";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${neueRegrade.variable} ${geistMono.variable} antialiased`}
      >
        <Web3ModalProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </Web3ModalProvider>
      </body>
    </html>
  );
}
