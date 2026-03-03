"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Tablet, Settings, ShieldCheck, LogOut, ArrowRightLeft, Activity, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppKitAccount, useAppKit, useDisconnect } from '@reown/appkit/react'
import { useRouter } from 'next/navigation'

import { AccountId } from "@hashgraph/sdk";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAppKitAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hederaId, setHederaId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    } else if (address) {
      // If address is native Hedera format (0.0.x), use it directly
      if (address.includes(".")) {
          setHederaId(address);
          checkAdminStatus(address);
      } else {
          // If EVM address (e.g. from Ledger or Metamask on Hedera), try to resolve
          fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.account) {
                setHederaId(data.account);
                checkAdminStatus(data.account); // Use resolved ID for admin check
              } else {
                  // Fallback to address itself if mirror node fails
                  checkAdminStatus(address);
              }
            })
            .catch(err => {
              console.warn("Failed to resolve Hedera ID from Mirror Node:", err);
              checkAdminStatus(address);
            });
      }
    }
  }, [isConnected, router, address])

  async function checkAdminStatus(walletAddress: string) {
    if (!walletAddress) return;
    
    // Check if we have a profile for this wallet
    // We check both the exact address/ID and potentially the EVM address if stored
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .or(`wallet_address.ilike.${walletAddress},wallet_address.eq.${walletAddress}`) // Robust check
      .limit(1)
      .maybeSingle();
    
    if (data?.is_admin) {
      setIsAdmin(true);
      if (pathname === '/dashboard') {
        router.push('/dashboard/admin');
      }
    }
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: Tablet, label: "My Devices", href: "/dashboard/devices" },
    { icon: ArrowRightLeft, label: "Swap Intents", href: "/dashboard/intents" },
    { icon: Settings, label: "Rules & Limits", href: "/dashboard/rules" },
    { icon: ShieldCheck, label: "Audit Logs", href: "/dashboard/audit" },
  ];

  // For Admins, we might want to prioritize the Admin Panel or hide the user dashboard
  if (isAdmin) {
    // Insert Admin Panel at the top for Admins
    navItems.unshift({ icon: ShieldAlert, label: "Admin Panel", href: "/dashboard/admin" });
  }

  // Render Navigation Items
  const renderNavItems = () => navItems.map((item) => {
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
  });

  const handleDisconnect = async () => {
    try {
      await disconnect();
      router.push('/');
    } catch (error) {
      console.error("Disconnect failed:", error);
      // Force redirect anyway
      router.push('/');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-secondary text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
            <Activity className="w-8 h-8" />
            Sweephy
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {renderNavItems()}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={handleDisconnect}
            className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-500/20 rounded-lg text-red-400 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            Disconnect Wallet
          </button>
        </div>
      </aside>

      {/* Main Content */}
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
