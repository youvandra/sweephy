"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Hourglass, ShoppingCart } from "lucide-react";

export default function SweepPage() {
  return (
    <div className="min-h-[100svh] bg-[#021B1A] font-sans text-white overflow-x-hidden relative">
      <Navbar variant="dark" />

      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-6 md:px-12 2xl:px-24 py-16 md:py-24">
        <div className="min-h-[calc(100svh-240px)] flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
            <Hourglass className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold tracking-widest text-primary uppercase">Coming Soon</span>
          </div>
          <h1 className="text-6xl md:text-8xl 2xl:text-9xl font-bold tracking-tighter leading-none">$SWEEP</h1>
          <p className="mt-6 text-lg md:text-xl 2xl:text-2xl text-gray-400 max-w-2xl leading-relaxed">
            The $SWEEP page is under construction. Updates will be announced soon.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link href="/buy">
              <Button variant="primary">
                <ShoppingCart className="w-4 h-4 2xl:w-5 2xl:h-5" />
                Buy Device
              </Button>
            </Link>
            <Link href="/">
              <Button variant="white">Back Home</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
