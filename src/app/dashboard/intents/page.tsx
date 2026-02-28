"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppKitAccount } from "@reown/appkit/react";
import { ArrowRightLeft, Clock, CheckCircle2, XCircle, AlertCircle, ExternalLink, Tablet } from "lucide-react";

export default function IntentsPage() {
  const { address } = useAppKitAccount();
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchIntents();
      const subscription = supabase
        .channel('intents-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'intents' }, () => {
          fetchIntents();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [address]);

  async function fetchIntents() {
    const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address).limit(1).maybeSingle();
    if (!profile) return;

    const { data } = await supabase
      .from("intents")
      .select("*, devices!inner(name, user_id)")
      .eq("devices.user_id", profile.id)
      .order("created_at", { ascending: false });
    
    setIntents(data || []);
    setLoading(false);
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      rejected: "bg-red-100 text-red-700 border-red-200",
      failed: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${styles[status] || styles.failed}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-secondary flex items-center gap-2">
          <ArrowRightLeft className="text-primary w-6 h-6" />
          Swap Intents
        </h1>
        <p className="text-gray-500 text-sm">Real-time monitoring of hardware-triggered trade intents</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Time</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Device</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Swap Pair</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading intents...</td></tr>
            ) : intents.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-medium">No swap intents detected yet. Click the physical button on your device!</td></tr>
            ) : intents.map((intent) => (
              <tr key={intent.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium">
                  {new Date(intent.created_at).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Tablet className="w-3 h-3 text-primary" />
                    <span className="text-xs font-bold text-secondary">{intent.devices?.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-secondary uppercase tracking-tight">
                  {intent.pair}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-secondary">
                  {intent.amount} HBAR
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={intent.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {intent.status === 'completed' ? (
                    <button className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      View TX
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-300">N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
