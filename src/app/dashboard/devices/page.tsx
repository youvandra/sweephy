"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, RotateCw, Trash2, Power, Shield, Tablet, Activity, AlertTriangle } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";

export default function DevicesPage() {
  const { address } = useAppKitAccount();
  const [devices, setDevices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [pairingCodeInput, setPairingCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);

  useEffect(() => {
    if (address) {
      fetchDevices();
      
      // Set up polling to keep device statuses (online/offline) fresh
      const interval = setInterval(fetchDevices, 10000); // every 10 seconds
      return () => clearInterval(interval);
    }
  }, [address]);

  async function getOrCreateProfile() {
    if (!address) return null;
    const { data: profile } = await supabase.from("profiles").select("id").eq("wallet_address", address).single();
    if (profile) return profile.id;

    const { data: newProfile } = await supabase.from("profiles").insert({
      id: crypto.randomUUID(),
      wallet_address: address,
    }).select().single();
    return newProfile?.id;
  }

  async function fetchDevices() {
    if (!address) return;
    const userId = await getOrCreateProfile();
    if (!userId) return;

    const { data } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setDevices(data || []);
  }

  async function handleClaimDevice() {
    if (!address || !pairingCodeInput) return;
    setLoading(true);
    try {
      const userId = await getOrCreateProfile();
      
      // 1. Check if pairing code exists and is valid
      const { data: codeData, error: codeError } = await supabase
        .from("pairing_codes")
        .select("*, devices(*)")
        .eq("code", pairingCodeInput.toUpperCase())
        .eq("used", false)
        .single();

      if (codeError || !codeData) throw new Error("Pairing code invalid or already used.");
      if (new Date(codeData.expires_at) < new Date()) throw new Error("This pairing code has expired.");

      const device = codeData.devices;

      // 2. Check if device is already paired to someone else
      if (device.is_paired || device.user_id) {
        throw new Error("This device is already paired to another account.");
      }

      // 3. Heartbeat Check: Ensure device is actually turned on and polling
      // Device updates 'last_seen' when polling for status or prices
      const lastSeen = new Date(device.last_seen);
      const now = new Date();
      const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

      if (!device.last_seen || diffSeconds > 30) {
        throw new Error("Device not detected. Please turn on your Sweephy device and wait for the pairing code to appear.");
      }

      // 4. Claim the device
      const { error: claimError } = await supabase
        .from("devices")
        .update({ 
          user_id: userId,
          is_paired: true,
          status: "online"
        })
        .eq("id", codeData.device_id);

      if (claimError) throw claimError;

      // 3. Mark code as used
      await supabase.from("pairing_codes").update({ used: true }).eq("id", codeData.id);

      alert("Device paired successfully!");
      setPairingCodeInput("");
      setIsAdding(false);
      fetchDevices();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, current: string) {
    const newStatus = current === "disabled" ? "online" : "disabled";
    await supabase.from("devices").update({ status: newStatus }).eq("id", id);
    fetchDevices();
  }

  async function confirmDelete() {
    if (!deviceToDelete) return;
    
    // Unpair the device (don't delete it, so it can be paired again)
    const { error } = await supabase
      .from("devices")
      .update({ 
        user_id: null, 
        is_paired: false,
        status: "offline" // Reset status
      })
      .eq("id", deviceToDelete.id);

    if (error) {
      alert("Error unpairing device: " + error.message);
    } else {
      // Also mark pairing code as unused? Or generate a new one?
      // The backend 'process-intent' will generate a new pairing code automatically
      // when the device sends its next heartbeat.
      fetchDevices();
    }
    setDeviceToDelete(null);
  }

  return (
    <div className="space-y-6 relative">
      {/* Delete Confirmation Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-red-50 rounded-2xl text-red-500">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary">Remove Device?</h3>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                  This will unbind <strong>{deviceToDelete.name}</strong> from your wallet. You will need a new pairing code to reconnect it.
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
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Device Management</h1>
          <p className="text-gray-500 text-sm">Manage and monitor your ESP32 swap devices</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-secondary font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add Device
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border-2 border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="font-bold mb-4">Pair New Device</h3>
          <div className="flex gap-4">
            <input 
              type="text" 
              placeholder="Enter 6-digit Pairing Code" 
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-primary uppercase font-mono"
              value={pairingCodeInput}
              onChange={(e) => setPairingCodeInput(e.target.value)}
              maxLength={6}
            />
            <button 
              onClick={handleClaimDevice}
              disabled={loading}
              className="bg-secondary text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50"
            >
              {loading ? "Pairing..." : "Verify & Pair"}
            </button>
            <button 
              onClick={() => setIsAdding(false)}
              className="px-6 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <div key={device.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-primary/10 transition-colors">
                  <Tablet className="w-6 h-6 text-secondary" />
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  device.status === "online" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {device.status}
                </div>
              </div>
              <h3 className="font-bold text-lg text-secondary mb-1">{device.name}</h3>
              <p className="text-xs text-gray-400 font-mono mb-4">{device.id}</p>
              
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  Last seen: {device.last_seen ? new Date(device.last_seen).toLocaleTimeString() : 'Never'}
                </div>
              </div>

              <div className="flex gap-2 border-t pt-4">
                <button 
                  onClick={() => toggleStatus(device.id, device.status)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-50 hover:bg-amber-50 text-amber-600 transition-colors text-xs font-bold"
                >
                  <Power className="w-3 h-3" />
                  {device.status === "disabled" ? "Enable" : "Disable"}
                </button>
                <button 
                  onClick={() => alert('Rotating secret for device: ' + device.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 text-blue-600 transition-colors text-xs font-bold"
                >
                  <RotateCw className="w-3 h-3" />
                  Rotate
                </button>
                <button 
                  onClick={() => setDeviceToDelete(device)}
                  className="p-2 rounded-lg bg-gray-50 hover:bg-red-50 text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {devices.length === 0 && !isAdding && (
        <div className="p-20 text-center flex flex-col items-center gap-4 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="p-4 bg-gray-50 rounded-full">
            <Tablet className="w-8 h-8 text-gray-300" />
          </div>
          <div>
            <p className="text-secondary font-bold">No devices paired yet</p>
            <p className="text-gray-500 text-sm">Click "Add Device" to bind your ESP32 hardware.</p>
          </div>
        </div>
      )}
    </div>
  );
}

