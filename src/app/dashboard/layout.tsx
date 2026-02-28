"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Tablet, Settings, ShieldCheck, LogOut, ArrowRightLeft, Activity, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppKitAccount, useAppKit } from '@reown/appkit/react'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, address } = useAppKitAccount()
  const { open } = useAppKit()
  const router = useRouter()
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      router.push('/')
    } else if (address) {
      checkAdminStatus();
    }
  }, [isConnected, router, address])

  async function checkAdminStatus() {
    const { data } = await supabase.from("profiles").select("is_admin").eq("wallet_address", address).single();
    if (data?.is_admin) setIsAdmin(true);
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: Tablet, label: "My Devices", href: "/dashboard/devices" },
    { icon: ArrowRightLeft, label: "Swap Intents", href: "/dashboard/intents" },
    { icon: Settings, label: "Rules & Limits", href: "/dashboard/rules" },
    { icon: ShieldCheck, label: "Audit Logs", href: "/dashboard/audit" },
  ];

  if (isAdmin) {
    navItems.push({ icon: ShieldAlert, label: "Admin Panel", href: "/dashboard/admin" });
  }

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
            onClick={() => {
              open({ view: 'Account' })
              router.push('/')
            }}
            className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
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
              <p className="text-sm font-medium text-secondary">{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connecting...'}</p>
              <p className="text-xs text-gray-500">Production Mode</p>
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
