"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Tablet, ShieldAlert, Key, Hash, AlertTriangle, X, Copy, Check, Info, ShieldCheck } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function AdminPage() {
  const { address } = useAppKitAccount();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);
  const [newDevice, setNewDevice] = useState<{ id: string; secret: string; pairingCode: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
      console.log("Checking admin status for address:", address);
      
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
      
      console.log("Admin check result:", data);
      
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

  // --- Display KMS Public Key ---
  // In a real app, you would fetch this from an Edge Function that queries KMS.
  // For now, we'll display the Account ID if we know it, or a placeholder.
  // Ideally, you'd store the KMS Public Key / Account ID in a 'platform_config' table.
  const kmsKeyId = "c3a98921-e9a0-40ed-9e20-2fcc970e75c9"; // New SECP256K1 Key
  const operatorId = "0.0.10304901"; // Real Hedera Account ID associated with KMS

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
        name: "Factory ESP32",
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
    } catch (err: any) {
      alert(err.message);
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
      alert("Error deleting device: " + error.message);
    } else {
      fetchAllDevices();
    }
    setDeviceToDelete(null);
  }

  if (checking) return <div className="p-20 text-center font-bold">Verifying Permissions...</div>;
  if (!isAdmin) return <div className="p-20 text-center font-bold text-red-500">Access Denied. Admins Only.</div>;

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

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-secondary flex items-center gap-2">
            <ShieldAlert className="text-primary" /> Admin Device Provisioning
          </h1>
          <p className="text-gray-500 text-sm">Create factory-fresh devices for users to claim</p>
        </div>
        <button 
          onClick={handleCreateDevice}
          disabled={loading}
          className="bg-secondary text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4 text-primary" /> {loading ? "Provisioning..." : "Provision New Device"}
        </button>
      </div>

      {/* KMS Info Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="text-green-400" /> Platform KMS Wallet
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              This is the Hedera account that signs transactions for users. 
              Users must grant allowance to this account.
            </p>
          </div>
          <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            Active
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Hedera Account ID</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xl font-bold tracking-tight">{operatorId}</p>
              <button onClick={() => copyToClipboard(operatorId, 'opId')} className="hover:text-green-400 transition-colors">
                {copiedField === 'opId' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">AWS KMS Key ID</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-slate-300 break-all">{kmsKeyId}</p>
              <button onClick={() => copyToClipboard(kmsKeyId, 'kmsId')} className="hover:text-green-400 transition-colors shrink-0">
                {copiedField === 'kmsId' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div key={device.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between">
              <div className="p-3 bg-gray-50 rounded-xl text-secondary">
                <Tablet className="w-6 h-6" />
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                device.user_id ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>
                {device.user_id ? "Claimed" : "Unclaimed"}
              </span>
            </div>
            
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase">Device ID</p>
              <p className="text-sm font-mono truncate">{device.id}</p>
              {device.profiles?.wallet_address && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-[10px] text-blue-500 font-bold uppercase">Owned By</p>
                  <p className="text-[10px] text-blue-700 font-mono truncate">{device.profiles.wallet_address}</p>
                </div>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${
              device.is_paired ? "bg-green-50 border-green-100" : "bg-primary/5 border-primary/10"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Key className={`w-3 h-3 ${device.is_paired ? "text-green-500" : "text-primary"}`} />
                <p className="text-xs font-bold text-secondary uppercase">
                  {device.is_paired ? "Status" : "Active Pairing Code"}
                </p>
              </div>
              <p className={`text-xl font-black tracking-widest ${
                device.is_paired ? "text-green-600" : "text-secondary"
              }`}>
                {device.is_paired ? "PAIRED" : (device.pairing_codes?.[0]?.code || "NONE")}
              </p>
            </div>

            <button 
              onClick={() => setDeviceToDelete(device)}
              className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> Remove Provision
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
