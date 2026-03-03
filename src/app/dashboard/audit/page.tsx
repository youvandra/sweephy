"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Filter, FileText, CheckCircle2, XCircle, AlertTriangle, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function AuditPage() {
  const { address } = useAppKitAccount();
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (address) {
      fetchLogs();
    }
  }, [address, currentPage, searchTerm]); // Refetch when page or search changes

  async function getProfileId() {
    if (!address) return null;
    // Match EVM or Hedera ID
    const { data } = await supabase.from("profiles").select("id").or(`wallet_address.ilike.${address},wallet_address.eq.${address}`).limit(1).maybeSingle();
    return data?.id;
  }

  async function fetchLogs() {
    const userId = await getProfileId();
    if (!userId) return;

    // Calculate range for pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("intent_logs")
      .select("*, intents!inner(*, devices!inner(name, user_id))", { count: 'exact' })
      .eq("intents.devices.user_id", userId)
      .order("timestamp", { ascending: false })
      .range(from, to);

    // Apply search filter if exists
    // Note: Filtering on joined tables in Supabase JS client can be tricky.
    // For simple search, we might filter on client side if dataset is small, 
    // or use specific text search columns if available.
    // Here we'll rely on the base query first. 
    // If you need deep search on joined fields (like device name), 
    // it's better to create a database view or function.
    // For now, let's keep it simple or user-side filter for displayed items if complex.
    
    // However, since we are paginating on server side, client-side filter only works for current page.
    // To search properly with pagination, we need server-side search.
    // Let's assume search is mainly for Transaction Hash which is in intent_logs.
    if (searchTerm) {
      query = query.ilike('tx_hash', `%${searchTerm}%`);
    }

    const { data, count, error } = await query;
    
    if (error) {
      console.error("Error fetching logs:", error);
      return;
    }

    setLogs(data || []);
    if (count !== null) setTotalCount(count);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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

        {/* Pagination Controls */}
        {logs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
            <div className="text-xs text-gray-500 font-medium">
              Showing <span className="font-bold text-secondary">{(currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="font-bold text-secondary">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of <span className="font-bold text-secondary">{totalCount}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Logic to show pages around current page could be complex
                  // For simplicity, showing first 5 or sliding window
                  let p = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    p = currentPage - 3 + i;
                    if (p > totalPages) p = totalPages - (4 - i);
                  }
                  
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === p 
                          ? "bg-secondary text-white shadow-md shadow-secondary/20" 
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

