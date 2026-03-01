"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Tablet, ArrowUpRight, TrendingUp, ShieldCheck, History, Activity } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function Dashboard() {
  const { address } = useAppKitAccount();
  const [stats, setStats] = useState({
    activeDevices: 0,
    dailySwaps: 0,
    pendingIntents: 0,
    totalVolume: 0,
  });

  const [recentIntents, setRecentIntents] = useState<any[]>([]);

  useEffect(() => {
    if (address) {
      fetchData();
      
      // Real-time subscription for updates
      const subscription = supabase
        .channel('dashboard-stats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => fetchData())
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [address]);

  async function getProfileId() {
    if (!address) return null;
    const { data } = await supabase.from("profiles").select("id").ilike("wallet_address", address).limit(1).maybeSingle();
    return data?.id;
  }

  async function fetchData() {
    const userId = await getProfileId();
    if (!userId) return;

    // 1. Fetch Active Devices
    const { count: activeDevices } = await supabase
      .from("devices")
      .select("id", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("status", "online");

    // 2. Fetch Today's Intents (for Daily Swaps & Volume)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todaysIntents } = await supabase
      .from("intents")
      .select("amount, status, devices!inner(user_id)")
      .eq("devices.user_id", userId)
      .gte("created_at", today.toISOString());

    const dailySwaps = todaysIntents?.filter(i => i.status === "completed").length || 0;
    const pendingIntents = todaysIntents?.filter(i => i.status === "pending").length || 0;
    const dailyVolume = todaysIntents?.filter(i => i.status === "completed").reduce((sum, i) => sum + Number(i.amount), 0) || 0;

    // 3. Fetch Recent Activity
    const { data: recent } = await supabase
      .from("intents")
      .select("*, devices!inner(name, user_id)")
      .eq("devices.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    setStats({
      activeDevices: activeDevices || 0,
      dailySwaps,
      pendingIntents,
      totalVolume: dailyVolume,
    });
    
    setRecentIntents(recent || []);
  }

  const statCards = [
    { 
      label: "Active Devices", 
      value: stats.activeDevices, 
      icon: Tablet, 
      color: "bg-blue-500",
      desc: "Online now"
    },
    { 
      label: "Daily Swaps", 
      value: stats.dailySwaps, 
      icon: TrendingUp, 
      color: "bg-green-500",
      desc: "Completed today"
    },
    { 
      label: "Pending Intents", 
      value: stats.pendingIntents, 
      icon: Activity, 
      color: "bg-amber-500",
      desc: "Awaiting signature"
    },
    { 
      label: "Daily Volume", 
      value: `${stats.totalVolume.toLocaleString()} ℏ`, 
      icon: ArrowUpRight, 
      color: "bg-indigo-500",
      desc: "HBAR Traded today"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between group hover:shadow-md transition-all">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{card.label}</p>
                <p className="text-3xl font-black text-secondary mb-1">{card.value}</p>
                <p className="text-[10px] text-gray-400 font-medium">{card.desc}</p>
              </div>
              <div className={`${card.color} p-3 rounded-xl text-white shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Recent Activity
            </h3>
            <button className="text-sm text-primary hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {recentIntents.map((intent) => (
              <div key={intent.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${intent.status === "completed" ? "bg-primary" : "bg-amber-500"}`} />
                  <div>
                    <p className="font-medium text-sm">{intent.action.toUpperCase()} {intent.pair}</p>
                    <p className="text-xs text-gray-500">{intent.devices.name} • {new Date(intent.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{intent.amount} HBAR</p>
                  <p className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    intent.status === "completed" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                  }`}>
                    {intent.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Security & Compliance
          </h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AWS KMS Integration</p>
                <p className="text-xs text-gray-500">All transactions are signed via hardware security modules.</p>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">ACTIVE</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">2FA Protection</p>
                <p className="text-xs text-gray-500">Critical actions require secondary authentication.</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">DISABLED</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Immutable Audit Logging</p>
                <p className="text-xs text-gray-500">All device intents are cryptographically logged.</p>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

