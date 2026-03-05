"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function BuyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00332c] via-[#004d40] to-[#001a17] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Navigation / Logo */}
      <nav className="relative z-10 flex justify-between items-center py-8 px-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </Link>
        <Image 
          src="/Logos/Logo_all-white.webp" 
          alt="Sweephy" 
          width={150} 
          height={42} 
          className="h-8 w-auto"
          priority
        />
        <div className="w-20" /> {/* Spacer for centering */}
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
        {/* Left: Product Image */}
        <div className="flex-1 w-full relative aspect-square max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-white/10">
           <Image 
            src="/landing/desk.png"
            alt="Sweephy Device" 
            fill
            className="object-cover"
          />
        </div>

        {/* Right: Product Details */}
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">Sweephy <span className="text-primary">One</span></h1>
            <p className="text-xl text-gray-300 max-w-lg">
              The dedicated crypto companion for your desk. Monitor prices, track portfolio, and swap instantly.
            </p>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-8">
            <div className="flex justify-between items-center text-2xl font-bold">
              <span>Price</span>
              <span>$199.00</span>
            </div>
            <p className="text-sm text-gray-400">Includes device, USB-C cable, and lifetime updates.</p>
          </div>

          <div className="space-y-4 pt-4">
             <button 
                className="w-full py-4 bg-primary text-secondary-darker rounded-full font-bold text-lg tracking-wider hover:bg-primary/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/20 cursor-not-allowed opacity-80"
                disabled
              >
                Coming Soon
              </button>
              <p className="text-center text-xs text-gray-500 uppercase tracking-widest">Free Shipping Worldwide</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="font-bold text-primary mb-1">Real-time</h3>
              <p className="text-sm text-gray-400">Live price updates via WiFi</p>
            </div>
             <div className="bg-white/5 p-4 rounded-xl border border-white/5">
              <h3 className="font-bold text-primary mb-1">Secure</h3>
              <p className="text-sm text-gray-400">Hardware-level security</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}