"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Tablet, 
  ArrowUpRight, 
  TrendingUp, 
  ShieldCheck, 
  History, 
  Activity, 
  Zap, 
  Shield, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function Dashboard() {
  const { address } = useAppKitAccount();
  const [stats, setStats] = useState({
    activeDevices: 0,
    dailySwaps: 0,
    totalSwaps: 0,
    pendingIntents: 0,
    dailyVolume: 0,
    totalVolume: 0,
  });

  const [recentIntents, setRecentIntents] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (address) {
      fetchData();
      
      const subscription = supabase
        .channel('dashboard-stats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => fetchData())
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      setFetching(false);
    }
  }, [address]);

  async function getProfileId() {
    if (!address) return null;
    const { data } = await supabase.from("profiles").select("id").or(`wallet_address.ilike.${address},wallet_address.eq.${address}`).limit(1).maybeSingle();
    return data?.id;
  }

  async function fetchData() {
    const userId = await getProfileId();
    if (!userId) {
      setFetching(false);
      return;
    }

    const { count: activeDevices } = await supabase
      .from("devices")
      .select("id", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("status", "online");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fetch Total Intents
    const { data: allIntents } = await supabase
      .from("intents")
      .select("amount, status, created_at, devices!inner(user_id)")
      .eq("devices.user_id", userId);

    const todaysIntents = allIntents?.filter(i => new Date(i.created_at) >= today) || [];
    const dailySwaps = todaysIntents.filter(i => i.status === "completed").length;
    const totalSwaps = allIntents?.filter(i => i.status === "completed").length || 0;
    const pendingIntents = allIntents?.filter(i => i.status === "pending").length || 0;
    const dailyVolume = todaysIntents?.filter(i => i.status === "completed").reduce((sum, i) => sum + Number(i.amount), 0) || 0;
    const totalVolume = allIntents?.filter(i => i.status === "completed").reduce((sum, i) => sum + Number(i.amount), 0) || 0;

    const { data: recent } = await supabase
      .from("intents")
      .select("*, devices!inner(name, user_id)")
      .eq("devices.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    setStats({
      activeDevices: activeDevices || 0,
      dailySwaps,
      totalSwaps,
      pendingIntents,
      dailyVolume,
      totalVolume,
    });
    
    setRecentIntents(recent || []);
    setFetching(false);
  }

  const StatSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 h-32 flex items-center justify-between">
          <div className="space-y-3">
            <div className="w-24 h-4 bg-gray-100 rounded"></div>
            <div className="w-16 h-8 bg-gray-100 rounded"></div>
          </div>
          <div className="w-12 h-12 bg-gray-100 rounded-2xl"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Dashboard Overview</h1>
          <p className="text-alt-1 mt-1">Real-time performance and security insights.</p>
        </div>
      </div>

      {fetching ? <StatSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Active Devices */}
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-gray-50 p-3 rounded-2xl text-gray-500">
                <Tablet className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Online</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">Active Devices</p>
              <p className="text-3xl font-black text-secondary leading-none">{stats.activeDevices}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Connected hardware
              </p>
            </div>
          </div>

          {/* Pending Intents */}
          <div className="bg-white p-6 rounded-[32px] border border-gray-100 hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-gray-50 p-3 rounded-2xl text-gray-500">
                <Activity className="w-5 h-5" />
              </div>
              {stats.pendingIntents > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-100 px-2 py-1 rounded-full">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Action Needed</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">Pending Intents</p>
              <p className="text-3xl font-black text-secondary leading-none">{stats.pendingIntents}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Awaiting signature
              </p>
            </div>
          </div>

          {/* Total Swaps (Combined) */}
          <div className="bg-gradient-to-br from-secondary to-gray-900 p-6 rounded-[32px] text-white shadow-lg shadow-secondary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-0.5">Today</p>
                  <p className="text-lg font-bold text-green-400">+{stats.dailySwaps}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em] mb-1">Total Swaps</p>
                <p className="text-3xl font-black leading-none">{stats.totalSwaps}</p>
                <p className="text-[10px] text-white/40 font-medium mt-2">Lifetime completed transactions</p>
              </div>
            </div>
          </div>

          {/* Total Volume (Combined) */}
          <div className="bg-gradient-to-br from-primary to-indigo-600 p-6 rounded-[32px] text-white shadow-lg shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start">
                <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-0.5">Today</p>
                  <p className="text-lg font-bold text-white">+{stats.dailyVolume.toLocaleString()} ℏ</p>
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.15em] mb-1">Total Volume</p>
                <p className="text-3xl font-black leading-none">{stats.totalVolume.toLocaleString()} <span className="text-sm font-bold text-white/60">ℏ</span></p>
                <p className="text-[10px] text-white/40 font-medium mt-2">Lifetime volume processed</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-secondary flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                  <History className="w-5 h-5" />
                </div>
                Recent Activity
              </h3>
              <Link href="/dashboard/audit" className="text-xs font-bold text-gray-400 hover:text-secondary transition-colors flex items-center gap-1 group">
                View Logs
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {recentIntents.length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                  <Zap className="w-8 h-8" />
                </div>
                <p className="text-gray-500 text-sm">No recent activity found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentIntents.map((intent) => (
                  <div key={intent.id} className="p-4 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                          intent.status === "completed" ? "bg-green-50 text-green-500 border-green-100" : "bg-amber-50 text-amber-500 border-amber-100"
                        }`}>
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-secondary text-sm flex items-center gap-2">
                            {intent.pair}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{intent.action}</span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1">
                              <span>{intent.devices.name}</span>
                              <span>•</span>
                              <span>{new Date(intent.created_at).toLocaleTimeString()}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-sm font-bold text-secondary">{intent.amount} <span className="text-[10px] text-gray-400">HBAR</span></p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Status & Security */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 space-y-8 h-full">
            <h3 className="text-xl font-bold text-secondary flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                <Shield className="w-5 h-5" />
              </div>
              Security Center
            </h3>

            <div className="space-y-6">
              {[
                { 
                  title: "KMS Integration", 
                  desc: "Hardware security signing", 
                  status: "Active", 
                  icon: ShieldCheck, 
                  active: true 
                },
                { 
                  title: "2FA Protection", 
                  desc: "Secondary authentication", 
                  status: "Disabled", 
                  icon: AlertCircle, 
                  active: false 
                },
                { 
                  title: "Audit Logging", 
                  desc: "Immutable activity trail", 
                  status: "Active", 
                  icon: CheckCircle2, 
                  active: true 
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                    item.active ? "bg-white border-gray-100 text-gray-400" : "bg-white border-gray-100 text-gray-400"
                  }`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-secondary text-sm">{item.title}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        item.active ? "text-green-600" : "text-amber-600"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-gray-50 mt-auto">
              <div className="bg-secondary text-white p-6 rounded-2xl relative overflow-hidden group cursor-pointer">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <h4 className="font-bold text-sm relative z-10">Security Audit</h4>
                <p className="text-xs text-white/60 mt-1 relative z-10">Last full audit: 2 days ago</p>
                <button className="mt-4 w-full bg-white text-secondary py-2 rounded-xl text-xs font-bold hover:bg-primary hover:text-secondary transition-colors relative z-10">
                  Run Quick Scan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

