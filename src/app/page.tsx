"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useRouter } from 'next/navigation'
import { AccountId } from "@hashgraph/sdk";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export default function Home() {
  const { open } = useAppKit()
  const { isConnected, address } = useAppKitAccount()
  const router = useRouter()
  
  // Scroll Animation for Marquee
  const marqueeRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: marqueeRef,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 30,
    damping: 30,
    restDelta: 0.001
  });

  const x = useTransform(smoothProgress, [0, 1], ["0%", "-10%"]);
  
  // Handle redirection after connection
  useEffect(() => {
    async function syncProfile() {
      if (isConnected && address) {
        const normalizedAddress = address.toLowerCase();
        let hederaId = null;
        
        try {
          const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${normalizedAddress}`);
          const data = await res.json();
          if (data && data.account) {
            hederaId = data.account;
          }
        } catch (e) {
          console.warn("Mirror Node lookup failed");
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("wallet_address", normalizedAddress)
          .limit(1)
          .maybeSingle();
        
        if (!profile) {
          await supabase.from("profiles").insert({
            wallet_address: normalizedAddress,
            hedera_account_id: hederaId
          });
        } else if (hederaId) {
          await supabase.from("profiles").update({ hedera_account_id: hederaId }).eq("id", profile.id);
        }
        
        router.push('/dashboard');
      }
    }

    if (isConnected && address) {
       syncProfile();
    }
  }, [isConnected, address, router])

  const handleBuyDevice = () => {
    router.push('/buy');
  };

  const handleSetupDevice = async () => {
    if (isConnected) {
      router.push('/dashboard');
    } else {
      await open();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00332c] via-[#004d40] to-[#001a17] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 pointer-events-none" />

      {/* Navigation / Logo */}
      <nav className="relative z-10 flex justify-center py-8">
        <Image 
          src="/Logos/Logo_all-white.webp" 
          alt="Sweephy" 
          width={300} 
          height={80} 
          className="h-12 md:h-16 2xl:h-24 w-auto"
          priority
        />
      </nav>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-[1920px] mx-auto px-6 md:px-12 2xl:px-24 pt-12 pb-20 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24 2xl:gap-32 min-h-[calc(100vh-120px)]">
        
        {/* Left Section */}
        <div className="flex-1 flex flex-col justify-center max-w-xl 2xl:max-w-3xl text-left h-full pb-20">
          {/* Title - Aligned with Image top */}
          <div className="mb-auto pt-8 2xl:pt-16">
            <h1 className="text-6xl md:text-8xl 2xl:text-9xl font-medium tracking-tight leading-[0.9]">
              What is <br />
              <span className="font-bold">sweephy?</span>
            </h1>
          </div>
          
          {/* Description - Aligned with CTA area */}
          <div className="pt-48 lg:pt-64 2xl:pt-80">
             <p className="text-xl md:text-2xl 2xl:text-4xl text-gray-200 font-light leading-relaxed max-w-lg 2xl:max-w-2xl">
              Sweephy is a smart desk device that enables busy professionals to monitor and swap crypto assets instantly — without opening their phone.
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex-1 flex flex-col items-start lg:items-end w-full h-full justify-between">
          
          {/* Hero Image Container - Aligned with Title */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-2xl mb-auto">
            {/* Placeholder for the laptop image - using a generic office/laptop placeholder */}
            <div className="absolute inset-0 bg-gray-800">
               <Image 
                src="/landing/lp.gif"
                alt="Sweephy Device Demo" 
                fill
                className="object-cover hover:opacity-100 transition-opacity duration-500"
                unoptimized
              />
            </div>
          </div>

          {/* Bottom Area: Headline + CTA - Aligned with Description */}
          <div className="flex flex-col items-start lg:items-end w-full pt-16 lg:pt-24 2xl:pt-32">
            {/* Headline */}
            <h2 className="text-5xl md:text-6xl 2xl:text-8xl font-bold uppercase tracking-tighter leading-[0.9] text-left lg:text-right w-full mb-8 2xl:mb-12">
              1-TAP SWAPS FROM <br />
              YOUR <span className="text-primary">DESK</span> .
            </h2>

            {/* Buttons */}
            <div className="flex flex-row gap-4 w-full justify-start lg:justify-end">
              <Button variant="white" onClick={handleBuyDevice}>
                BUY DEVICE
              </Button>
              <Button variant="primary" onClick={handleSetupDevice}>
                SETUP DEVICE
              </Button>
            </div>
          </div>

        </div>
      </main>

      {/* Section 2: Marquee + Features */}
      <section className="bg-secondary-light">
        {/* Marquee Banner */}
        <div className="bg-secondary-darker py-4 overflow-hidden border-y border-white/10" ref={marqueeRef}>
          <motion.div style={{ x }} className="flex w-max">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-8 mx-4">
                <span className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">Crypto</span>
                <span className="text-xl md:text-2xl font-bold text-primary uppercase tracking-widest">•</span>
                <span className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">Stocks</span>
                <span className="text-xl md:text-2xl font-bold text-primary uppercase tracking-widest">•</span>
                <span className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">Prices</span>
                <span className="text-xl md:text-2xl font-bold text-primary uppercase tracking-widest">•</span>
                <span className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">Swaps</span>
                <span className="text-xl md:text-2xl font-bold text-primary uppercase tracking-widest">•</span>
                <span className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">Portfolio</span>
                <span className="text-xl md:text-2xl font-bold text-primary uppercase tracking-widest">•</span>
                <span className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">Real-time</span>
                <span className="text-xl md:text-2xl font-bold text-primary uppercase tracking-widest">•</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Split Content */}
        <div className="flex flex-col lg:flex-row min-h-[80vh]">
          {/* Left Content */}
          <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20 bg-[#F1F7F6]">
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-6xl font-bold mb-8 leading-tight" style={{ color: '#081819' }}>
                What you care <br />
                about at a glance
              </h2>
              
              <p className="text-lg md:text-xl mb-10 leading-relaxed" style={{ color: '#081819' }}>
                Sweephy is a retro-style display that lets you keep up with the things 
                you care about, like real-time crypto prices, portfolio value, 
                and instant swaps right from your desk.
              </p>

              <Button variant="outline-dark">
                Learn More
              </Button>
            </div>
          </div>

          {/* Right Image */}
          <div className="flex-1 relative min-h-[400px] lg:min-h-full bg-gray-100">
             <Image 
              src="/landing/desk.png"
              alt="Sweephy on Desk" 
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
