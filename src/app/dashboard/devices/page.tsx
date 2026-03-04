"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Trash2, Power, Tablet, Wifi, WifiOff, Edit2, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useProfile } from "@/hooks/useProfile";
import { fetchDevices, toggleDeviceStatus, deleteDevice, renameDevice, claimDevice } from "@/lib/api/devices";

export default function DevicesPage() {
  const { userId, loading: profileLoading } = useProfile();
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
    if (userId) {
      loadDevices();
      const subscription = supabase
        .channel('devices-update')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => loadDevices())
        .subscribe();
      
      const interval = setInterval(loadDevices, 10000); 
      return () => {
        supabase.removeChannel(subscription);
        clearInterval(interval);
      };
    } else if (!profileLoading && !userId) {
      setFetching(false);
    }
  }, [userId, profileLoading]);

  async function loadDevices() {
    if (!userId) return;
    const data = await fetchDevices(userId);
    setDevices(data);
    setFetching(false);
  }

  async function handleClaimDevice() {
    if (!userId || !pairingCodeInput) return;
    setLoading(true);
    try {
      await claimDevice(userId, pairingCodeInput);
      setPairingCodeInput("");
      setIsAdding(false);
      loadDevices();
      toast.success("Device successfully paired!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteDevice() {
    if (!deviceToDelete) return;
    const { error } = await deleteDevice(deviceToDelete.id);

    if (!error) {
      loadDevices();
      setDeviceToDelete(null);
      toast.success("Device removed successfully");
    } else {
      toast.error("Failed to remove device");
    }
  }

  async function handleRenameDevice() {
    if (!editingDevice || !newDeviceName.trim()) return;
    const { error } = await renameDevice(editingDevice.id, newDeviceName);

    if (!error) {
      loadDevices();
      setEditingDevice(null);
      setNewDeviceName("");
      toast.success("Device renamed successfully");
    } else {
      toast.error("Failed to rename device");
    }
  }

  async function handleToggleStatus(device: any) {
    const newDisabledStatus = !device.is_disabled;
    const { error } = await toggleDeviceStatus(device.id, newDisabledStatus);
    
    if (!error) {
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

      {/* Delete Confirmation Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-secondary mb-2">Remove Device?</h3>
            <p className="text-gray-500 text-sm mb-6">Are you sure you want to remove this device? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeviceToDelete(null)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteDevice}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Grid */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                            className="p-1 rounded-lg text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/title:opacity-100 lg:group-hover/title:opacity-100 lg:opacity-0 opacity-100"
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
                          onClick={() => handleToggleStatus(device)}
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

