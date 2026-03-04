"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Tablet, 
  ArrowUpRight, 
  TrendingUp, 
  Activity, 
} from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useProfile } from "@/hooks/useProfile";
import { fetchDashboardStats, fetchRecentIntents, DashboardStats, Intent } from "@/lib/api/dashboard";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { SecurityCenter } from "@/components/dashboard/SecurityCenter";

export default function Dashboard() {
  const { address } = useAppKitAccount();
  const { userId, loading: profileLoading } = useProfile();
  
  const [stats, setStats] = useState<DashboardStats>({
    activeDevices: 0,
    dailySwaps: 0,
    totalSwaps: 0,
    pendingIntents: 0,
    dailyVolume: 0,
    totalVolume: 0,
  });

  const [recentIntents, setRecentIntents] = useState<Intent[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (userId) {
      loadData();
      
      const subscription = supabase
        .channel('dashboard-stats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => loadData())
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    } else if (!profileLoading && !userId) {
      setFetching(false);
    }
  }, [userId, profileLoading]);

  async function loadData() {
    if (!userId) return;
    try {
      const [newStats, newRecent] = await Promise.all([
        fetchDashboardStats(userId),
        fetchRecentIntents(userId)
      ]);
      setStats(newStats);
      setRecentIntents(newRecent);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setFetching(false);
    }
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
          <StatCard 
            title="Active Devices"
            value={stats.activeDevices}
            subtitle="Connected hardware"
            icon={Tablet}
            badge={{ text: "Online", color: "green" }}
          />

          <StatCard 
            title="Pending Intents"
            value={stats.pendingIntents}
            subtitle="Awaiting signature"
            icon={Activity}
            variant={stats.pendingIntents > 0 ? "warning" : "default"}
            badge={stats.pendingIntents > 0 ? { text: "Action Needed", color: "amber" } : undefined}
          />

          <StatCard 
            title="Total Swaps"
            value={stats.totalSwaps}
            subtitle={`+${stats.dailySwaps}`}
            icon={TrendingUp}
            variant="gradient-green"
            badge={{ text: "Today", color: "green" }}
          />

          <StatCard 
            title="Total Volume"
            value={`${stats.totalVolume.toLocaleString()} ℏ`}
            subtitle={`+${stats.dailyVolume.toLocaleString()} ℏ`}
            icon={ArrowUpRight}
            variant="gradient-blue"
            badge={{ text: "Today", color: "green" }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity intents={recentIntents} />
        </div>

        {/* System Status & Security */}
        <div className="space-y-6">
          <SecurityCenter />
        </div>
      </div>
    </div>
  );
}

