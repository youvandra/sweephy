"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Filter, FileText, CheckCircle2, XCircle, AlertTriangle, Shield } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function AuditPage() {
  const { address } = useAppKitAccount();
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (address) {
      fetchLogs();
    }
  }, [address]);

  async function getProfileId() {
    if (!address) return null;
    const { data } = await supabase.from("profiles").select("id").eq("wallet_address", address).single();
    return data?.id;
  }

  async function fetchLogs() {
    const userId = await getProfileId();
    if (!userId) return;

    const { data } = await supabase
      .from("intent_logs")
      .select("*, intents!inner(*, devices!inner(name, user_id))")
      .eq("intents.devices.user_id", userId)
      .order("timestamp", { ascending: false });
    
    setLogs(data || []);
  }

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-primary" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Audit Trail</h1>
          <p className="text-gray-500 text-sm">Immutable history of all device activities and signatures</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-secondary">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl hover:bg-secondary/90 transition-colors text-sm font-bold shadow-sm shadow-secondary/10">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by Transaction Hash or Device..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Action / Pair</th>
                <th className="px-6 py-4">Signed By</th>
                <th className="px-6 py-4">Tx Hash</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm text-secondary font-medium">{new Date(log.timestamp).toLocaleDateString()}</p>
                    <p className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-secondary">
                    {log.intents?.devices?.name || 'Unknown Device'}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-secondary">{log.intents?.action?.toUpperCase()} {log.intents?.pair}</p>
                    <p className="text-[10px] text-primary font-bold">{log.intents?.amount} HBAR</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter ${
                      log.signed_by === 'kms' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {log.signed_by}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 group/hash">
                      <p className="text-xs text-gray-400 font-mono max-w-[120px] truncate">{log.tx_hash}</p>
                      <button className="opacity-0 group-hover/hash:opacity-100 transition-opacity p-1 bg-gray-100 rounded">
                        <FileText className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={log.intents?.status} />
                      <span className="text-xs font-bold text-secondary capitalize">{log.intents?.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {logs.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <Shield className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm">No audit logs found. Perform a swap to see activity here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

