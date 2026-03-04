import { supabase } from "@/lib/supabase";

export async function fetchAllUsers() {
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function fetchAllDevices() {
  const { data } = await supabase.from('devices').select('*, profiles(wallet_address)').order('created_at', { ascending: false });
  return data || [];
}

export async function fetchSystemStats() {
  const { count: totalUsers } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  const { count: activeDevices } = await supabase.from('devices').select('id', { count: 'exact', head: true }).eq('status', 'online');
  const { count: totalSwaps } = await supabase.from('intents').select('id', { count: 'exact', head: true }).eq('status', 'completed');
  
  // Volume aggregation
  const { data: volumeData } = await supabase.from('intents').select('amount').eq('status', 'completed');
  const totalVolume = volumeData?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;

  return {
    totalUsers: totalUsers || 0,
    activeDevices: activeDevices || 0,
    totalSwaps: totalSwaps || 0,
    totalVolume
  };
}
