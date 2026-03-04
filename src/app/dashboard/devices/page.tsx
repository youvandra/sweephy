"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, RotateCw, Trash2, Power, Shield, Tablet, Activity, AlertTriangle, CheckCircle2, Wifi, WifiOff, Edit2, X } from "lucide-react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useToast } from "@/components/ui/Toast";

export default function DevicesPage() {
  const { address } = useAppKitAccount();
  const toast = useToast();
  const [devices, setDevices] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [pairingCodeInput, setPairingCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deviceToDelete, setDeviceToDelete] = useState<any>(null);
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [newDeviceName, setNewDeviceName] = useState("");

  useEffect(() => {
    if (address) {
      fetchDevices();
      
      const interval = setInterval(fetchDevices, 10000); 
      return () => clearInterval(interval);
    } else {
      setFetching(false);
    }
  }, [address]);

  async function getOrCreateProfile() {
    if (!address) return null;
    let { data: profile } = await supabase.from("profiles").select("id").or(`wallet_address.ilike.${address},wallet_address.eq.${address}`).single();
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
    if (!userId) {
      setFetching(false);
      return;
    }

    const { data } = await supabase
      .from("devices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setDevices(data || []);
    setFetching(false);
  }

  async function handleClaimDevice() {
    if (!address || !pairingCodeInput) return;
    setLoading(true);
    try {
      const userId = await getOrCreateProfile();
      
      const { data: codeData, error: codeError } = await supabase
        .from("pairing_codes")
        .select("*, devices(*)")
        .eq("code", pairingCodeInput.toUpperCase())
        .eq("used", false)
        .single();

      if (codeError || !codeData) throw new Error("Pairing code invalid or already used.");
      if (new Date(codeData.expires_at) < new Date()) throw new Error("This pairing code has expired.");

      const device = codeData.devices;

      if (device.is_paired || device.user_id) {
        throw new Error("This device is already paired to another account.");
      }

      const lastSeen = new Date(device.last_seen);
      const now = new Date();
      const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

      if (!device.last_seen || diffSeconds > 30) {
        throw new Error("Device not detected. Please turn on your Sweephy device and wait for the pairing code to appear.");
      }

      const { error: claimError } = await supabase
        .from("devices")
        .update({ 
          user_id: userId,
          is_paired: true,
          status: "online"
        })
        .eq("id", codeData.device_id);

      if (claimError) throw claimError;

      await supabase
        .from("pairing_codes")
        .update({ used: true })
        .eq("id", codeData.id);

      setPairingCodeInput("");
      setIsAdding(false);
      fetchDevices();
      toast.success("Device successfully paired!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDevice() {
    if (!deviceToDelete) return;
    const { error } = await supabase
      .from("devices")
      .update({ user_id: null, is_paired: false, status: "offline" })
      .eq("id", deviceToDelete.id);

    if (!error) {
      fetchDevices();
      setDeviceToDelete(null);
      toast.success("Device removed successfully");
    } else {
      toast.error("Failed to remove device");
    }
  }

  async function handleRenameDevice() {
    if (!editingDevice || !newDeviceName.trim()) return;
    
    const { error } = await supabase
      .from("devices")
      .update({ name: newDeviceName.trim() })
      .eq("id", editingDevice.id);

    if (!error) {
      fetchDevices();
      setEditingDevice(null);
      setNewDeviceName("");
      toast.success("Device renamed successfully");
    } else {
      toast.error("Failed to rename device");
    }
  }

  async function toggleDeviceStatus(device: any) {
    // Toggle is_disabled
    const newDisabledStatus = !device.is_disabled;
    
    const { error } = await supabase.from("devices").update({ is_disabled: newDisabledStatus }).eq("id", device.id);
    
    if (!error) {
      // Optimistically update local state to reflect change immediately without waiting for fetchDevices
      setDevices(prevDevices => prevDevices.map(d => 
        d.id === device.id ? { ...d, is_disabled: newDisabledStatus } : d
      ));
      toast.success(`Device ${newDisabledStatus ? "disabled" : "enabled"} successfully`);
    } else {
      toast.error("Failed to update device status");
    }
  }

  const DeviceSkeleton = () => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 h-64 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl"></div>
            <div className="w-20 h-6 bg-gray-100 rounded-full"></div>
          </div>
          <div className="space-y-3">
            <div className="w-32 h-6 bg-gray-100 rounded-lg"></div>
            <div className="w-48 h-4 bg-gray-100 rounded-lg"></div>
          </div>
          <div className="w-full h-10 bg-gray-100 rounded-xl mt-4"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">My Devices</h1>
          <p className="text-alt-1 mt-1">Manage your connected Sweephy hardware wallets.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-bold hover:bg-secondary/90 hover:shadow-lg hover:shadow-secondary/20 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {/* Add Device Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-2xl max-w-md w-full relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAdding(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                <Tablet className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary">Pair New Device</h3>
                <p className="text-gray-500 mt-2 text-sm">Enter the 6-digit code displayed on your Sweephy device screen.</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={pairingCodeInput}
                  onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                  placeholder="A1B2C3"
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 border-b-2 border-gray-200 focus:border-primary outline-none transition-all placeholder:text-gray-200 uppercase"
                  maxLength={6}
                />
              </div>
              <button 
                onClick={handleClaimDevice}
                disabled={loading || pairingCodeInput.length < 6}
                className="w-full bg-primary text-secondary py-3.5 rounded-xl font-bold hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Pairing..." : "Connect Device"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Device Modal */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-secondary mb-4">Rename Device</h3>
            <input
              type="text"
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              placeholder="Enter new name"
              className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl font-bold text-secondary focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all mb-6"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setEditingDevice(null); setNewDeviceName(""); }}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleRenameDevice}
                disabled={!newDeviceName.trim()}
                className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold hover:bg-secondary/90 transition-all disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {fetching ? <DeviceSkeleton /> : (
        <>
          {devices.length === 0 ? (
            <div className="bg-white rounded-[32px] border border-gray-100 p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                <Tablet className="w-10 h-10 text-gray-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-secondary">No Devices Connected</h3>
                <p className="text-gray-500 mt-1 max-w-md mx-auto">
                  You haven't paired any Sweephy hardware wallets yet. Click "Add Device" to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => {
                const isOnline = (new Date().getTime() - new Date(device.last_seen).getTime()) / 1000 < 60; // 60s threshold
                const isDisabled = device.is_disabled;
                
                return (
                  <div key={device.id} className={`group bg-white rounded-[32px] p-6 border border-gray-100 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden ${isDisabled ? 'opacity-75' : ''}`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full -mr-8 -mt-8 transition-opacity ${isOnline && !isDisabled ? 'opacity-100' : 'opacity-0'}`} />
                    
                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                      <div className="flex justify-between items-start">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isOnline && !isDisabled ? 'bg-primary text-secondary' : 'bg-gray-100 text-gray-400'}`}>
                          <Tablet className="w-7 h-7" />
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isDisabled ? "bg-gray-200 text-gray-500" : (isOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")
                        }`}>
                          {isDisabled ? <Power className="w-3 h-3" /> : (isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />)}
                          {isDisabled ? "Disabled" : (isOnline ? "Online" : "Offline")}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 group/title">
                          <h3 className="text-lg font-bold text-secondary truncate max-w-[180px]">{device.name}</h3>
                          <button 
                            onClick={() => { setEditingDevice(device); setNewDeviceName(device.name); }}
                            className="p-1 rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/title:opacity-100"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="mt-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Last Seen</span>
                            <span className="font-medium text-secondary">{new Date(device.last_seen).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Firmware</span>
                            <span className="font-medium text-secondary">v1.0.2</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-50 flex gap-2">
                        <button 
                          onClick={() => toggleDeviceStatus(device)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                            isDisabled 
                              ? "bg-primary text-secondary hover:bg-primary/90" 
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {isDisabled ? "Enable" : "Disable"}
                        </button>
                        <button 
                          onClick={() => setDeviceToDelete(device)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

