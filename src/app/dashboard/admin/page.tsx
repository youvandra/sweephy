"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Tablet, ShieldAlert, Key, Hash } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function AdminPage() {
  const { address } = useAppKitAccount();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (address) checkAdmin();
  }, [address]);

  async function checkAdmin() {
    setChecking(true);
    const { data } = await supabase.from("profiles").select("is_admin").eq("wallet_address", address).single();
    if (data?.is_admin) {
      setIsAdmin(true);
      fetchUnclaimedDevices();
    }
    setChecking(false);
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

  if (checking) return <div className="p-20 text-center font-bold">Verifying Permissions...</div>;
  if (!isAdmin) return <div className="p-20 text-center font-bold text-red-500">Access Denied. Admins Only.</div>;

  return (
    <div className="space-y-8">
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
              onClick={async () => {
                if(confirm("Delete this unclaimed device?")) {
                  await supabase.from("devices").delete().eq("id", device.id);
                  fetchUnclaimedDevices();
                }
              }}
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
