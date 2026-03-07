"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { PieChart, Wallet, ArrowRight, Zap, Globe, ShieldCheck, Coins, BarChart3, Lock } from "lucide-react";

export default function SweepPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <div className="min-h-screen bg-[#021B1A] font-sans text-white overflow-hidden relative">
      <Navbar variant="dark" />

      {/* Hero Section - Dark Gradient */}
      <section className="relative z-10 pt-32 pb-20 px-6 2xl:px-24 max-w-[1920px] mx-auto bg-gradient-to-b from-[#021B1A] to-[#042220]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] animate-pulse-slow" />
        </div>
        <div className="flex flex-col items-center text-center space-y-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-bold tracking-widest text-primary uppercase">The Native Utility Token</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-7xl md:text-9xl font-bold tracking-tighter leading-none"
          >
            $SWEEP
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-gray-400 max-w-2xl leading-relaxed"
          >
            Powering the first dedicated hardware ecosystem on Hedera. 
            <span className="text-white font-medium"> Stake, vote, and unlock</span> exclusive features.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex gap-4 pt-8"
          >
            <Link href="/buy">
              <Button variant="primary">
                <Wallet className="w-4 h-4 2xl:w-5 2xl:h-5" />
                Buy $SWEEP
              </Button>
            </Link>
            <Button variant="white">
              <ShieldCheck className="w-4 h-4 2xl:w-5 2xl:h-5" />
              View Contract
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Grid - Darker Background */}
      <section className="relative z-10 py-20 px-6 2xl:px-24 bg-[#011413]">
        <div className="max-w-[1920px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {[
              { label: "Total Supply", value: "1B", sub: "Fixed Cap" },
              { label: "Network", value: "Hedera", sub: "HTS Token" },
              { label: "Token Type", value: "Utility", sub: "& Governance" },
              { label: "Launch", value: "Q3 2026", sub: "Fair Launch" },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/5 p-8 rounded-3xl backdrop-blur-sm text-center group hover:border-primary/30 transition-all hover:bg-white/10"
              >
                <h3 className="text-4xl md:text-5xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{stat.value}</h3>
                <p className="text-gray-400 font-medium uppercase tracking-wider text-sm">{stat.label}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Token Distribution - Dark Teal Background */}
      <section className="relative z-10 py-32 px-6 2xl:px-24 bg-[#022220]" ref={containerRef}>
        <div className="max-w-[1920px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="flex-1 space-y-8">
              <h2 className="text-4xl md:text-6xl font-bold leading-tight">
                Fair & Transparent <br />
                <span className="text-primary">Distribution</span>
              </h2>
              <p className="text-lg text-gray-400 max-w-xl leading-relaxed">
                Designed for long-term sustainability. The majority of tokens are allocated to the community and ecosystem growth, with strict vesting schedules for the team.
              </p>
              
              <div className="grid gap-4">
                {[
                  { label: "Community & Rewards", value: "40%", color: "bg-primary" },
                  { label: "Treasury & Reserve", value: "25%", color: "bg-[#8B5CF6]" },
                  { label: "Team (Vested)", value: "20%", color: "bg-[#3B82F6]" },
                  { label: "Liquidity", value: "15%", color: "bg-[#64748B]" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors">
                    <div className={`w-3 h-3 rounded-full ${item.color} mr-4 shadow-[0_0_10px_currentColor]`} />
                    <span className="flex-1 font-medium text-gray-200">{item.label}</span>
                    <span className="text-xl font-bold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Graphic */}
            <div className="flex-1 relative w-full aspect-square max-w-lg mx-auto">
              <motion.div style={{ y }} className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-blue-500/20 rounded-full blur-3xl" />
              <div className="relative w-full h-full bg-[#081819] rounded-full border border-white/10 p-8 shadow-2xl flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-white/5 animate-spin-slow" />
                <div className="absolute inset-12 rounded-full border border-primary/20 animate-reverse-spin" />
                
                <div className="text-center z-10 space-y-2">
                  <Coins className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-5xl font-bold">1B</h3>
                  <p className="text-sm font-bold tracking-widest uppercase text-gray-500">Total Supply</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Utility Cards - Light Grid Background */}
      <section className="relative z-10 py-32 bg-[#021B1A] border-y border-white/5">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        
        <div className="max-w-[1920px] mx-auto px-6 2xl:px-24 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Token Utility</h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Unlock the full potential of your Sweephy device.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Hardware Access", desc: "Unlock pro features, faster refresh rates, and multi-wallet support on your device." },
              { icon: Lock, title: "Staking Rewards", desc: "Earn APY and ecosystem airdrops by staking $SWEEP directly from your dashboard." },
              { icon: Globe, title: "Governance", desc: "Shape the future. Vote on new integrations, supported chains, and feature requests." },
            ].map((card, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="bg-[#042220] p-10 rounded-[32px] border border-white/5 hover:border-primary/30 transition-all group shadow-2xl"
              >
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                  <card.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{card.title}</h3>
                <p className="text-gray-400 leading-relaxed text-lg">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Modern Roadmap - White Background */}
      <section className="relative z-10 py-32 px-6 2xl:px-24 bg-white text-secondary-darkest overflow-hidden">
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-secondary-darkest">The Roadmap</h2>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
          </div>

          <div className="relative space-y-24 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-secondary/20 before:to-transparent">
            {[
              { 
                phase: "01", 
                title: "Foundation", 
                items: ["Concept & Design", "Whitepaper V1", "Community Launch", "$SWEEP TGE"],
                status: "done"
              },
              { 
                phase: "02", 
                title: "Hardware", 
                items: ["Prototype Beta", "Pre-order Access", "First Batch Shipping", "Software V1"],
                status: "active"
              },
              { 
                phase: "03", 
                title: "Expansion", 
                items: ["Mobile App Launch", "Staking Live", "Global Retail", "Partner Integrations"],
                status: "future"
              },
              { 
                phase: "04", 
                title: "Ecosystem", 
                items: ["Sweephy Pro", "DAO Governance", "Multi-chain Hub", "Developer SDK"],
                status: "future"
              }
            ].map((milestone, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${
                  i % 2 === 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Center Dot */}
                <div className={`absolute left-0 md:left-1/2 w-10 h-10 rounded-full border-4 border-white flex items-center justify-center z-10 -translate-x-1/2 md:translate-x-[-50%] shadow-[0_0_20px_rgba(0,0,0,0.1)] ${
                  milestone.status === "done" ? "bg-primary" : 
                  milestone.status === "active" ? "bg-secondary-darkest animate-pulse" : "bg-gray-200"
                }`}>
                  {milestone.status === "done" && <div className="w-3 h-3 bg-white rounded-full" />}
                </div>

                {/* Card */}
                <div className="w-[calc(100%-60px)] md:w-[calc(50%-40px)] ml-auto md:mx-0 p-8 rounded-3xl bg-secondary-light border border-secondary/5 hover:border-primary/30 transition-all hover:bg-white hover:shadow-xl backdrop-blur-sm group-hover:-translate-y-1 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-4xl font-bold text-secondary/10 font-mono">PHASE {milestone.phase}</span>
                    {milestone.status === "active" && (
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary-dark text-xs font-bold uppercase tracking-widest animate-pulse">Current</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold mb-6 text-secondary-darkest">{milestone.title}</h3>
                  <ul className="space-y-3">
                    {milestone.items.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-secondary/70 group-hover:text-secondary transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full ${milestone.status === "done" ? "bg-primary" : "bg-secondary/20"}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Gradient Background */}
      <section className="relative z-10 py-32 text-center px-6 bg-gradient-to-t from-[#021B1A] to-[#010e0d]">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight">
            Join the <span className="text-primary">Revolution</span>
          </h2>
          <p className="text-xl text-gray-400">
            Be part of the future of physical DeFi. Secure your allocation today.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4 pt-4">
            <Link href="/buy">
              <Button variant="primary">
                <Wallet className="w-4 h-4 2xl:w-5 2xl:h-5" />
                Start Trading
              </Button>
            </Link>
            <Link href="https://discord.gg/sweephy" target="_blank">
              <Button variant="white">
                <Globe className="w-4 h-4 2xl:w-5 2xl:h-5" />
                Join Discord
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
