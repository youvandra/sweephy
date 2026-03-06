"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { PieChart, Wallet, ArrowRight, Zap, Globe, ShieldCheck } from "lucide-react";

export default function TokenomicsPage() {
  return (
    <div className="min-h-screen bg-[#081819] font-sans text-white overflow-hidden relative">
      {/* Background Glow Effect */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-30 pointer-events-none" />

      {/* Navbar */}
      <Navbar variant="dark" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 2xl:px-24 max-w-[1920px] mx-auto text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary text-sm font-bold uppercase tracking-widest mb-4">
            <Zap className="w-4 h-4" />
            Powered by Hedera
          </div>
          <h1 className="text-5xl md:text-7xl 2xl:text-9xl font-bold tracking-tight leading-[0.9]">
            The <span className="text-primary">SWEEP</span> <br /> Economy
          </h1>
          <p className="text-xl 2xl:text-3xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            A sustainable, utility-driven token model designed to power the next generation of hardware-integrated DeFi.
          </p>
        </motion.div>
      </section>

      {/* Token Distribution Chart (Visual Representation) */}
      <section className="py-20 px-6 2xl:px-24 max-w-[1920px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Chart Graphic */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative aspect-square max-w-xl mx-auto lg:mx-0 w-full"
          >
            {/* Custom CSS Pie Chart Representation */}
            <div className="relative w-full h-full rounded-full border-[20px] border-white/5 flex items-center justify-center p-12">
               <div className="absolute inset-0 rounded-full border-[40px] border-primary/20 animate-spin-slow opacity-30" />
               <div className="absolute inset-10 rounded-full border-[2px] border-dashed border-white/10 animate-reverse-spin" />
               
               <div className="text-center z-10">
                 <h3 className="text-6xl font-bold text-white">1B</h3>
                 <p className="text-gray-400 uppercase tracking-widest text-sm mt-2">Total Supply</p>
               </div>

               {/* Orbital Labels */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 bg-[#081819] px-4 py-2 border border-white/10 rounded-xl">
                 <span className="text-primary font-bold">40%</span> Community
               </div>
               <div className="absolute bottom-10 right-0 bg-[#081819] px-4 py-2 border border-white/10 rounded-xl">
                 <span className="text-blue-400 font-bold">20%</span> Team
               </div>
               <div className="absolute bottom-10 left-0 bg-[#081819] px-4 py-2 border border-white/10 rounded-xl">
                 <span className="text-purple-400 font-bold">25%</span> Treasury
               </div>
            </div>
          </motion.div>

          {/* Detailed Breakdown */}
          <div className="space-y-8">
            <h2 className="text-4xl font-bold mb-8">Token Allocation</h2>
            
            <div className="space-y-4">
              {[
                { label: "Community & Rewards", percent: "40%", color: "bg-primary", desc: "Staking rewards, airdrops, and ecosystem incentives." },
                { label: "Treasury & Reserve", percent: "25%", color: "bg-purple-500", desc: "Future development, marketing, and strategic partnerships." },
                { label: "Team & Advisors", percent: "20%", color: "bg-blue-500", desc: "Vested over 24 months to ensure long-term alignment." },
                { label: "Liquidity & Listings", percent: "15%", color: "bg-gray-500", desc: "DEX/CEX liquidity provision and market making." },
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/5 border border-white/5 p-6 rounded-2xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${item.color}`} />
                      <h3 className="text-xl font-bold">{item.label}</h3>
                    </div>
                    <span className="text-2xl font-bold text-white">{item.percent}</span>
                  </div>
                  <p className="text-gray-400 text-sm pl-6">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Utility Grid */}
      <section className="py-20 bg-white/5 border-y border-white/5">
        <div className="max-w-[1920px] mx-auto px-6 2xl:px-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Utility & Value</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              $SWEEP isn't just a governance token. It's the fuel for the Sweephy hardware ecosystem.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Wallet, title: "Hardware Discounts", desc: "Hold $SWEEP to unlock exclusive discounts on Sweephy devices and accessories." },
              { icon: ShieldCheck, title: "Staking Tiers", desc: "Stake tokens to unlock premium features like advanced analytics and faster refresh rates." },
              { icon: Globe, title: "Governance", desc: "Vote on future device features, supported chains, and ecosystem partnerships." },
            ].map((feature, i) => (
              <div key={i} className="bg-[#081819] p-8 rounded-3xl border border-white/10 hover:border-primary/50 transition-colors group">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 text-center px-6">
        <h2 className="text-5xl md:text-7xl font-bold mb-8">Ready to join?</h2>
        <div className="flex flex-col md:flex-row justify-center gap-4">
          <Link href="/buy">
            <Button variant="primary">
              <Wallet className="w-4 h-4" />
              Buy $SWEEP
            </Button>
          </Link>
          <Link href="/whitepaper">
            <Button variant="outline-dark" className="border-white text-white hover:bg-white hover:text-[#081819]">
              Read Whitepaper
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
