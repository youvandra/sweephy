"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Tablet, ShieldAlert, Key, Hash, AlertTriangle, X, Copy, Check, Info, ShieldCheck, CheckCircle2, Search, Filter } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useToast } from "@/components/ui/Toast";

export default function AdminPage() {
  const { address } = useAppKitAccount();
  const toast = useToast();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);
  const [newDevice, setNewDevice] = useState<{ id: string; secret: string; pairingCode: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "claimed" | "unclaimed">("all");

  useEffect(() => {
    if (address) checkAdmin();
  }, [address]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  async function checkAdmin() {
    if (!address) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      
      // Support checking via Hedera ID or EVM Address
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .or(`wallet_address.ilike.${address},wallet_address.eq.${address}`)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("Supabase error checking admin status:", error.message, error.details, error.hint);
      }
      
      if (data?.is_admin) {
        setIsAdmin(true);
        fetchAllDevices();
      } else {
        console.warn("User is not an admin according to database.");
      }
    } catch (err) {
      console.error("Unexpected error in checkAdmin:", err);
    } finally {
      setChecking(false);
    }
  }

  // Display KMS Public Key from environment variables
  const kmsKeyId = process.env.NEXT_PUBLIC_KMS_KEY_ID || "Not Configured";
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "Not Configured";

  async function fetchAllDevices() {
    // Admins should see ALL devices. 
    // We explicitly select profiles(wallet_address) to show ownership.
    const { data, error } = await supabase
      .from("devices")
      .select(`
        *, 
        pairing_codes(*), 
        profiles!devices_user_id_fkey (
          wallet_address
        )
      `)
      .order("created_at", { ascending: false });
    
    if (error) console.error("Error fetching devices:", error);
    setDevices(data || []);
  }

  async function handleCreateDevice() {
    setLoading(true);
    try {
      const secret = Math.random().toString(36).slice(-10);
      const { data: device, error: deviceError } = await supabase.from("devices").insert({
        name: "Sweephy Device",
        secret_hash: secret,
        status: "offline",
        is_paired: false
      }).select().single();

      if (deviceError) throw deviceError;

      const code = Math.random().toString(36).slice(-6).toUpperCase();
      await supabase.from("pairing_codes").insert({
        code,
        device_id: device.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours for admin created
      });

      fetchAllDevices();
      setNewDevice({ id: device.id, secret, pairingCode: code });
      toast.success("Device provisioned successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deviceToDelete) return;
    
    // Clean up related tables first (if CASCADE is missing)
    await supabase.from("pairing_codes").delete().eq("device_id", deviceToDelete.id);
    await supabase.from("intents").delete().eq("device_id", deviceToDelete.id);
    await supabase.from("intent_logs").delete().match({ intent_id: deviceToDelete.id }); // Intent logs link to intents, but maybe device_id isn't there directly. Let's trust CASCADE or intent delete.

    const { error } = await supabase.from("devices").delete().eq("id", deviceToDelete.id);
    if (error) {
      console.error("Delete error:", error);
      toast.error("Error deleting device: " + error.message);
    } else {
      fetchAllDevices();
      toast.success("Device removed successfully");
    }
    setDeviceToDelete(null);
  }

  if (checking) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-bold text-secondary">Verifying Administrative Access...</p>
      </div>
    </div>
  );
  
  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-secondary">Access Denied</h2>
        <p className="text-gray-500">You do not have permission to view this page. This area is restricted to platform administrators only.</p>
        <button onClick={() => window.history.back()} className="px-6 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-secondary/90 transition-all">
          Go Back
        </button>
      </div>
    </div>
  );

  const filteredDevices = devices.filter(d => {
    const matchesSearch = 
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.profiles?.wallet_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.pairing_codes?.[0]?.code?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterStatus === "all") return true;
    if (filterStatus === "claimed") return !!d.user_id;
    if (filterStatus === "unclaimed") return !d.user_id;
    
    return true;
  });

  return (
    <div className="space-y-8 relative">
      {/* Delete Confirmation Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-red-50 rounded-2xl text-red-500">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary">Remove Provision?</h3>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                  This will permanently delete the device record and its pairing code. You cannot undo this.
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-xl w-full border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Device ID</p>
                <p className="text-xs font-mono text-secondary truncate">{deviceToDelete.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full pt-4">
                <button 
                  onClick={() => setDeviceToDelete(null)}
                  className="py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Device Success Modal */}
      {newDevice && (
        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-secondary">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold">Device Provisioned!</h3>
              <p className="text-gray-500 text-sm">
                Copy these credentials to your ESP32 firmware now. The secret will <strong>never</strong> be shown again.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Device ID</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100 font-mono text-xs break-all">
                    {newDevice.id}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(newDevice.id, 'id')}
                    className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
                  >
                    {copiedField === 'id' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Device Secret</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-amber-50 p-3 rounded-xl border border-amber-100 font-mono text-sm font-bold text-amber-700">
                    {newDevice.secret}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(newDevice.secret, 'secret')}
                    className="p-3 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-100"
                  >
                    {copiedField === 'secret' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-amber-600" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Pairing Code</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-primary/5 p-3 rounded-xl border border-primary/10 font-black text-xl text-center tracking-widest">
                    {newDevice.pairingCode}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(newDevice.pairingCode, 'code')}
                    className="p-3 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors border border-primary/10"
                  >
                    {copiedField === 'code' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-primary" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 border border-blue-100">
              <Info className="w-5 h-5 text-blue-500 shrink-0" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Paste the <strong>Device ID</strong> and <strong>Secret</strong> into your <code>sweephy.ino</code> file. Use the <strong>Pairing Code</strong> on the user's dashboard to link the device.
              </p>
            </div>

            <button 
              onClick={() => setNewDevice(null)}
              className="w-full py-4 rounded-2xl font-bold bg-secondary text-white hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
            >
              I've saved the credentials
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3 h-3" />
            Admin Portal
          </div>
          <h1 className="text-3xl font-bold text-secondary">Device Provisioning</h1>
          <p className="text-gray-500 mt-1">Create and manage factory devices for distribution.</p>
        </div>
        <button 
          onClick={handleCreateDevice}
          disabled={loading}
          className="bg-secondary text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-3 hover:bg-secondary/90 hover:shadow-lg hover:shadow-secondary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus className="w-5 h-5 text-primary" />
          )}
          {loading ? "Provisioning..." : "Provision New Device"}
        </button>
      </div>

      {/* KMS Info (Minimal) */}
      <div className="flex items-center gap-4 px-2 py-1 opacity-50 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck className="w-3 h-3" />
          <span className="font-medium">KMS System Active</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-gray-300" />
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
          <span>OP: {operatorId}</span>
          <span className="text-gray-300">|</span>
          <span>KEY: {kmsKeyId.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search devices by ID, wallet, or code..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-secondary focus:bg-white focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar px-2 md:px-0">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="h-6 w-px bg-gray-200 mx-2 shrink-0" />
          {(['all', 'claimed', 'unclaimed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                filterStatus === status 
                  ? "bg-secondary text-white shadow-lg shadow-secondary/20" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredDevices.map((device) => {
          const isClaimed = !!device.user_id;
          const isPaired = device.is_paired;
          
          return (
            <div key={device.id} className="group bg-white p-4 rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl transition-colors ${
                    isClaimed ? "bg-primary/10 text-primary" : "bg-gray-50 text-gray-400"
                  }`}>
                    <Tablet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-secondary text-sm font-mono" title={device.id}>
                        {device.id.slice(0, 8)}...
                      </p>
                      <button 
                        onClick={() => copyToClipboard(device.id, `dev-${device.id}`)}
                        className="text-gray-300 hover:text-primary transition-colors"
                      >
                        {copiedField === `dev-${device.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isClaimed ? "text-green-600" : "text-amber-600"
                    }`}>
                      {isClaimed ? "Claimed" : "Inventory"}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setDeviceToDelete(device)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Revoke Provision"
                >
                  <Trash2 className="w-4 h-4" /> 
                </button>
              </div>

              <div className="space-y-2">
                {/* Pairing Code / Status - Simplified */}
                <div className={`px-3 py-2 rounded-xl border flex items-center justify-between ${
                  isPaired ? "bg-green-50/50 border-green-100" : "bg-primary/5 border-primary/10"
                }`}>
                  <div className="flex items-center gap-2">
                    {isPaired ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Key className="w-3.5 h-3.5 text-primary" />
                    )}
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                      {isPaired ? "Paired" : "Code:"}
                    </span>
                  </div>
                  {!isPaired && (
                    <span className="font-mono font-black text-secondary tracking-widest text-sm">
                      {device.pairing_codes?.[0]?.code || "---"}
                    </span>
                  )}
                </div>

                {/* Owner Info - Only if claimed */}
                {device.profiles?.wallet_address && (
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500 shrink-0">
                      {device.profiles.wallet_address[2].toUpperCase()}
                    </div>
                    <p className="text-[10px] font-mono text-gray-400 truncate">
                      {device.profiles.wallet_address}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
