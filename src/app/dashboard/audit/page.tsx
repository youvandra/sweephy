"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Filter, FileText, CheckCircle2, XCircle, AlertTriangle, Shield, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function AuditPage() {
  const { address } = useAppKitAccount();
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  // Filter State
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDevice, setFilterDevice] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (address) {
      fetchLogs();
      fetchDevices();
    }
  }, [address, currentPage, searchTerm, filterStatus, filterDevice, filterDate]); 

  async function getProfileId() {
    if (!address) return null;
    // Match EVM or Hedera ID
    const { data } = await supabase.from("profiles").select("id").or(`wallet_address.ilike.${address},wallet_address.eq.${address}`).limit(1).maybeSingle();
    return data?.id;
  }

  async function fetchDevices() {
    const userId = await getProfileId();
    if (!userId) return;
    const { data } = await supabase.from('devices').select('id, name').eq('user_id', userId);
    setDevices(data || []);
  }

  async function fetchLogs() {
    const userId = await getProfileId();
    if (!userId) return;

    // 1. Get all device IDs for the user.
    let deviceIds: string[] = [];
    
    if (filterDevice !== 'all') {
      // If filtering by specific device
      deviceIds = [filterDevice];
    } else {
      // If 'all', get all user devices
      const { data: userDevices } = await supabase.from('devices').select('id').eq('user_id', userId);
      deviceIds = userDevices?.map(d => d.id) || [];
    }
    
    if (deviceIds.length === 0) {
      setLogs([]);
      setTotalCount(0);
      return;
    }

    // 2. Get all intent IDs for these devices
    // Apply Status filter here on intents
    let intentQuery = supabase.from('intents').select('id').in('device_id', deviceIds);
    
    if (filterStatus !== 'all') {
        intentQuery = intentQuery.eq('status', filterStatus);
    }

    const { data: userIntents } = await intentQuery;
    const intentIds = userIntents?.map(i => i.id) || [];

    if (intentIds.length === 0) {
      setLogs([]);
      setTotalCount(0);
      return;
    }

    // Calculate range for pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // 3. Query intent_logs filtering by these intent IDs
    let query = supabase
      .from("intent_logs")
      .select("*, intents(*, devices(name))", { count: 'exact' }) 
      .in('intent_id', intentIds)
      .order("timestamp", { ascending: false })
      .range(from, to);

    if (searchTerm) {
      query = query.ilike('tx_hash', `%${searchTerm}%`);
    }

    if (filterDate) {
      // Filter by date (ignoring time)
      const startDate = new Date(filterDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filterDate);
      endDate.setHours(23, 59, 59, 999);
      
      query = query.gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString());
    }

    const { data, count, error } = await query;
    
    if (error) {
      console.error("Error fetching logs:", error);
      return;
    }

    setLogs(data || []);
    if (count !== null) setTotalCount(count);
  }

  async function handleExportCSV() {
    const userId = await getProfileId();
    if (!userId) return;

    // Fetch ALL logs without pagination but WITH filters
    
    // 1. Get device IDs (respecting filter)
    let deviceIds: string[] = [];
    if (filterDevice !== 'all') {
      deviceIds = [filterDevice];
    } else {
      const { data: userDevices } = await supabase.from('devices').select('id').eq('user_id', userId);
      deviceIds = userDevices?.map(d => d.id) || [];
    }
    
    if (deviceIds.length === 0) return;

    // 2. Get intent IDs (respecting status filter)
    let intentQuery = supabase.from('intents').select('id').in('device_id', deviceIds);
    if (filterStatus !== 'all') {
        intentQuery = intentQuery.eq('status', filterStatus);
    }

    const { data: userIntents } = await intentQuery;
    const intentIds = userIntents?.map(i => i.id) || [];
    if (intentIds.length === 0) return;

    // 3. Get Logs (respecting search & date)
    let query = supabase
      .from("intent_logs")
      .select("*, intents(*, devices(name))")
      .in('intent_id', intentIds)
      .order("timestamp", { ascending: false });

    if (searchTerm) {
      query = query.ilike('tx_hash', `%${searchTerm}%`);
    }

    if (filterDate) {
      const startDate = new Date(filterDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filterDate);
      endDate.setHours(23, 59, 59, 999);
      query = query.gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString());
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      alert("No logs found to export with current filters.");
      return;
    }

    // Convert to CSV
    const csvContent = [
      ["Timestamp", "Device", "Action", "Pair", "Amount", "Signed By", "Tx Hash", "Status"],
      ...data.map(log => [
        new Date(log.timestamp).toISOString(),
        log.intents?.devices?.name || "Unknown",
        log.intents?.action,
        log.intents?.pair,
        log.intents?.amount,
        log.signed_by,
        log.tx_hash,
        log.intents?.status
      ])
    ].map(e => e.join(",")).join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Audit Logs</h1>
          <p className="text-alt-1 mt-1">Real-time immutable record of all device interactions and swaps.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold transition-all ${
              showFilter ? "bg-secondary text-white border-secondary" : "bg-white text-secondary border-gray-200 hover:border-secondary"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-secondary">Filter Logs</h3>
            <button onClick={() => setShowFilter(false)} className="text-gray-400 hover:text-red-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/10 focus:border-secondary"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Device</label>
              <select 
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/10 focus:border-secondary"
              >
                <option value="all">All Devices</option>
                {devices.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-secondary/10 focus:border-secondary"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by Transaction Hash..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-medium focus:bg-white focus:border-secondary/20 focus:ring-4 focus:ring-secondary/5 outline-none transition-all"
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

