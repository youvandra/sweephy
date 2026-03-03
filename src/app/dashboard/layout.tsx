"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Tablet, Settings, ShieldCheck, LogOut, ArrowRightLeft, Activity, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

import { useAppKitAccount, useAppKit, useDisconnect } from '@reown/appkit/react'
import { useRouter } from 'next/navigation'

import { AccountId } from "@hashgraph/sdk";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, address, status } = useAppKitAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hederaId, setHederaId] = useState<string | null>(null);

  // ✅ Gunakan dua kondisi: timeout fallback + isConnected definitif
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Safety net: paksa hydrated setelah 1.5s walau isConnected masih undefined
    // Ini handle kasus AppKit lambat resolve karena dual-network setup
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

  // ✅ FIX: Tampilkan loading spinner selama AppKit hydrating
  // Ini mencegah children render sebelum auth state siap,
  // sekaligus mencegah redirect prematur
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary-light">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-alt-1 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const NavContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center gap-2">
          <Image 
            src="/Logos/Logo_all-white.png" 
            alt="Sweephy" 
            width={140} 
            height={40} 
            className="h-8 w-auto"
            priority
          />
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? "bg-primary text-secondary font-bold" : "hover:bg-white/10"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={handleDisconnect}
          className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-500/20 rounded-lg text-red-400 transition-colors text-left cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          Disconnect Wallet
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-secondary-light font-sans text-secondary">
      <aside className="w-64 bg-secondary text-white flex flex-col">
        <NavContent />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-xl font-semibold text-secondary capitalize">
            {pathname.split("/").pop() || "Dashboard"}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-secondary">
                {hederaId ? hederaId : (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connecting...')}
              </p>
              <p className="text-xs text-gray-500">Hedera Mainnet</p>
            </div>
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
              {address?.[0]?.toUpperCase() || 'W'}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}