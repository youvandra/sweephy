"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Tablet, Settings, ShieldCheck, LogOut, ArrowRight, Activity, ShieldAlert, Sparkles, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { useAppKitAccount, useAppKit, useDisconnect } from '@reown/appkit/react'
import { useRouter, redirect } from 'next/navigation'

import { AccountId } from "@hashgraph/sdk";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, address, status } = useAppKitAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hederaId, setHederaId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ✅ Use two conditions: timeout fallback + definitive isConnected status
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Safety net: force hydrated after 1.5s even if isConnected is still undefined
    // Handles cases where AppKit resolves slowly due to dual-network setup
    const timeout = setTimeout(() => {
      setHydrated(true);
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // Wait for hydration or definitive status
    // status can be 'connected', 'disconnected', 'connecting', 'reconnecting'
    // We should NOT redirect if status is 'connecting' or 'reconnecting'
    if (status === 'connecting' || status === 'reconnecting') return;
    
    // If isConnected is undefined, wait.
    if (isConnected === undefined) return;

    setHydrated(true);

    // Only redirect if explicitly disconnected AND status is confirmed 'disconnected'
    if (isConnected === false && status === 'disconnected') {
      router.replace('/');
    } else if (address) {
      if (address.includes(".")) {
        setHederaId(address);
        checkAdminStatus(address);
      } else {
        fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`)
          .then(res => res.json())
          .then(data => {
            if (data?.account) {
              setHederaId(data.account);
              checkAdminStatus(data.account);
            } else {
              checkAdminStatus(address);
            }
          })
          .catch(() => checkAdminStatus(address));
      }
    }
  }, [isConnected, address, router, status]);

  async function checkAdminStatus(walletAddress: string) {
    if (!walletAddress) return;
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .or(`wallet_address.ilike.${walletAddress},wallet_address.eq.${walletAddress}`)
      .limit(1)
      .maybeSingle();
    if (data?.is_admin) setIsAdmin(true);
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: Tablet, label: "My Devices", href: "/dashboard/devices" },
    { icon: Settings, label: "Rules & Limits", href: "/dashboard/rules" },
    { icon: ShieldCheck, label: "Audit Logs", href: "/dashboard/audit" },
  ];

  if (isAdmin) {
    navItems.unshift({ icon: ShieldAlert, label: "Admin Panel", href: "/dashboard/admin" });
  }

  const handleDisconnect = async () => {
    try {
      await disconnect();
      window.location.href = '/';
    } catch (error) {
      console.error("Disconnect failed:", error);
      window.location.href = '/';
    }
  };

  // ✅ Show nothing while AppKit is hydrating
  if (!hydrated) {
    return null;
  }

  // ✅ Redirect to root page if user is not connected
  if (!isConnected) {
    redirect('/');
  }

  return (
    <div className="flex h-screen bg-secondary-light font-sans text-secondary overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-secondary text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex-shrink-0 ${
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}>
        <div className="flex flex-col h-full w-full">
          <div className="p-6 flex justify-between items-center">
            <Image 
              src="/Logos/Logo_all-white.webp" 
              alt="Sweephy" 
              width={196} 
              height={56} 
              className="h-10 w-auto"
              priority
            />
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive ? "bg-primary text-secondary font-bold" : "hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10 mt-auto">
            <button 
              onClick={handleDisconnect}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-500/20 rounded-lg text-red-400 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              Disconnect
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 flex justify-between items-center sticky top-0 z-10 w-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-secondary hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="group relative overflow-hidden bg-secondary text-white px-4 sm:px-6 py-2.5 rounded-2xl cursor-pointer transition-all hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.02] border border-white/10 hidden sm:block">
              {/* Background Effects */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-2xl rounded-full -mr-10 -mt-10" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/20 blur-2xl rounded-full -ml-8 -mb-8" />
              
              {/* Content */}
              <div className="flex items-center gap-3 relative z-10">
                <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="flex flex-col leading-none gap-1">
                  <p className="text-[10px] font-bold text-primary tracking-widest uppercase">Limited Offer</p>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    Get <span className="text-primary">50% OFF</span> Sweephy Product
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/50 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-secondary">
                {hederaId || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connecting...')}
              </p>
              <div className="flex items-center justify-end gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hedera Mainnet</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}