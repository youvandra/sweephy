"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Shield, Zap, Tablet, Wallet } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useRouter } from 'next/navigation'
import { AccountId } from "@hashgraph/sdk";

export default function Home() {
  const { open } = useAppKit()
  const { isConnected, address } = useAppKitAccount()
  const router = useRouter()
  
  const handleConnect = async () => {
    if (isConnected) {
      router.push('/dashboard')
    } else {
      await open()
    }
  }

  // Effect to handle redirection after connection
  useEffect(() => {
    async function syncProfile() {
      if (isConnected && address) {
        // Normalize address to lowercase
        const normalizedAddress = address.toLowerCase();
        
        // Resolve Hedera Account ID from Mirror Node
        let hederaId = null;
        try {
          const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${normalizedAddress}`);
          const data = await res.json();
          if (data && data.account) {
            hederaId = data.account;
          }
        } catch (e) {
          console.warn("Mirror Node lookup failed, trying local conversion");
          try {
            hederaId = AccountId.fromEvmAddress(0, 0, address).toString();
          } catch (err) {}
        }

        // Sync wallet address & Hedera ID with Supabase (Case-insensitive)
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, is_admin")
          .ilike("wallet_address", normalizedAddress)
          .limit(1)
          .maybeSingle();
        
        if (!profile) {
          // New user, create profile
          await supabase.from("profiles").insert({
            wallet_address: normalizedAddress,
            hedera_account_id: hederaId // Store the Hedera ID
          });
          router.push('/dashboard');
        } else {
          // Existing user, update Hedera ID if missing
          if (hederaId) {
            await supabase.from("profiles").update({ hedera_account_id: hederaId }).eq("id", profile.id);
          }

          // Check admin status for redirect
          if (profile.is_admin) {
            router.push('/dashboard/admin');
          } else {
            router.push('/dashboard');
          }
        }
      }
    }
    syncProfile();
  }, [isConnected, address, router])

  return (
    <div className="min-h-screen bg-white font-sans text-secondary">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Image 
            src="/Logos/Logo_mark-green_text-black.png" 
            alt="Sweephy" 
            width={140} 
            height={40} 
            className="h-10 w-auto"
            priority
          />
        </div>
        <div className="hidden md:flex items-center gap-8 font-medium">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#security" className="hover:text-primary transition-colors">Security</a>
          <button 
            onClick={handleConnect}
            className="bg-secondary text-white px-6 py-2 rounded-full font-bold hover:bg-secondary/90 transition-all cursor-pointer"
          >
            Setup
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-8 py-20 max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
            <Zap className="w-4 h-4" />
            Production Ready v1.0
          </div>
          <h1 className="text-6xl lg:text-7xl font-bold leading-tight">
            1-Tap Swaps for <span className="text-primary">ESP32</span> Devices.
          </h1>
          <p className="text-xl text-alt-1 max-w-lg leading-relaxed">
            Secure, auditable, and hardware-bound crypto trading. Connect your ESP32 device, set your rules, and swap with a single physical click.
          </p>
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full" />
          <div className="relative bg-secondary rounded-[40px] p-8 border border-white/10 shadow-2xl">
            {/* Mock Dashboard UI */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="w-12 h-12 bg-primary/20 rounded-2xl" />
                <div className="flex gap-2">
                  <div className="w-24 h-8 bg-white/5 rounded-full" />
                  <div className="w-8 h-8 bg-white/5 rounded-full" />
                </div>
              </div>
              <div className="h-40 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl border border-primary/20" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-white/5 rounded-3xl" />
                <div className="h-24 bg-white/5 rounded-3xl" />
              </div>
            </div>
            {/* ESP32 Floating Card */}
            <div className="absolute -bottom-10 -left-10 bg-white p-6 rounded-3xl shadow-2xl border border-secondary-medium animate-bounce-slow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <Tablet className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-xs text-alt-2 font-bold uppercase tracking-wider">Device Active</p>
                  <p className="font-bold text-secondary">ESP32-S3 Node</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-secondary-light py-24 px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold">Built for Security & Speed</h2>
            <p className="text-alt-1">Enterprise-grade infrastructure for your personal desktop trading device.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: "AWS KMS Signing", desc: "Transactions are signed via FIPS 140-2 Level 3 hardware modules. Keys never leave the cloud." },
              { icon: Wallet, title: "Multi-Wallet", desc: "Support for HashPack, WalletConnect, and custodial KMS wallets for maximum flexibility." },
              { icon: Activity, title: "Real-time Audits", desc: "Every intent, signature, and transaction is logged in an immutable Postgres trail." },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-10 rounded-[32px] border border-secondary-medium hover:shadow-xl transition-all group">
                <div className="p-4 bg-primary/10 rounded-2xl text-primary w-fit mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-alt-1 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-secondary-medium">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Image 
              src="/Logos/Logo_mark-green_text-black.png" 
              alt="Sweephy" 
              width={140} 
              height={40} 
              className="h-8 w-auto"
            />
          </div>
          <p className="text-alt-2 text-sm">© 2026 Sweephy Protocol. Production Ready.</p>
          <div className="flex gap-6 text-sm font-medium text-alt-1">
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Github</a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
