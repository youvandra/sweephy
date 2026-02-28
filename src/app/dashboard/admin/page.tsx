"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Tablet, ShieldAlert, Key, Hash, AlertTriangle, X } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function AdminPage() {
  const { address } = useAppKitAccount();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);

  useEffect(() => {
    if (address) checkAdmin();
  }, [address]);

  async function checkAdmin() {
    if (!address) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      console.log("Checking admin status for address:", address);
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .ilike("wallet_address", address)
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("Supabase error checking admin status:", error);
      }
      
      console.log("Admin check result:", data);
      
      if (data?.is_admin) {
        setIsAdmin(true);
        fetchUnclaimedDevices();
      } else {
        console.warn("User is not an admin according to database.");
      }
    } catch (err) {
      console.error("Unexpected error in checkAdmin:", err);
    } finally {
      setChecking(false);
    }
  }

  async function fetchUnclaimedDevices() {
    const { data } = await supabase
      .from("devices")
      .select("*, pairing_codes(*)")
      .is("user_id", null)
      .order("created_at", { ascending: false });
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

      fetchUnclaimedDevices();
      alert(`Device Ready! \nID: ${device.id}\nSecret: ${secret}\nPairing Code: ${code}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deviceToDelete) return;
    
    const { error } = await supabase.from("devices").delete().eq("id", deviceToDelete.id);
    if (error) {
      console.error("Delete error:", error);
      alert("Error deleting device: " + error.message);
    } else {
      fetchUnclaimedDevices();
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div key={device.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between">
              <div className="p-3 bg-gray-50 rounded-xl text-secondary">
                <Tablet className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-100 text-amber-700 rounded">Unclaimed</span>
            </div>
            
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase">Device ID</p>
              <p className="text-sm font-mono truncate">{device.id}</p>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center gap-2 mb-1">
                <Key className="w-3 h-3 text-primary" />
                <p className="text-xs font-bold text-secondary uppercase">Active Pairing Code</p>
              </div>
              <p className="text-xl font-black text-secondary tracking-widest">
                {device.pairing_codes?.[0]?.code || "NONE"}
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
