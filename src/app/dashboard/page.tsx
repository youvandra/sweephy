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
    }
  }, [address]);

  async function getProfileId() {
    if (!address) return null;
    const { data } = await supabase.from("profiles").select("id").eq("wallet_address", address).single();
    return data?.id;
  }

  async function fetchData() {
    const userId = await getProfileId();
    if (!userId) return;

    // Fetch devices for this user
    const { data: devices } = await supabase
      .from("devices")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "online");

    // Fetch intents for devices belonging to this user
    const { data: intents } = await supabase
      .from("intents")
      .select("amount, status, created_at, devices!inner(user_id)")
      .eq("devices.user_id", userId)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    setStats({
      activeDevices: devices?.length || 0,
      dailySwaps: intents?.filter(i => i.status === "completed").length || 0,
      pendingIntents: intents?.filter(i => i.status === "pending").length || 0,
      totalVolume: intents?.reduce((sum, i) => sum + Number(i.amount), 0) || 0,
    });

    // Fetch recent intents for this user's devices
    const { data: recent } = await supabase
      .from("intents")
      .select("*, devices!inner(name, user_id)")
      .eq("devices.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    
    setRecentIntents(recent || []);
  }

  const statCards = [
    { label: "Active Devices", value: stats.activeDevices, icon: Tablet, color: "bg-blue-500" },
    { label: "Daily Swaps", value: stats.dailySwaps, icon: TrendingUp, color: "bg-primary" },
    { label: "Pending Intents", value: stats.pendingIntents, icon: Activity, color: "bg-amber-500" },
    { label: "Daily Volume", value: `$${stats.totalVolume}`, icon: ArrowUpRight, color: "bg-indigo-500" },
  ];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-secondary">{card.value}</p>
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

