import { supabase } from "@/lib/supabase";

export interface Intent {
  id: string;
  pair: string;
  action: string;
  amount: number;
  status: string;
  tx_id: string;
  created_at: string;
  devices: {
    name: string;
    user_id: string;
  };
}

export interface DashboardStats {
  activeDevices: number;
  dailySwaps: number;
  totalSwaps: number;
  pendingIntents: number;
  dailyVolume: number;
  totalVolume: number;
}

export async function fetchDashboardStats(userId: string): Promise<DashboardStats> {
  const { count: activeDevices, error: activeDevicesError } = await supabase
    .from("devices")
    .select("id", { count: 'exact', head: true })
    .eq("user_id", userId)
    .eq("status", "online");
  if (activeDevicesError) throw new Error(activeDevicesError.message);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: allIntents, error: intentsError } = await supabase
    .from("intents")
    .select("amount, status, created_at, devices!inner(user_id)")
    .eq("devices.user_id", userId);
  if (intentsError) throw new Error(intentsError.message);

  const todaysIntents = allIntents?.filter(i => new Date(i.created_at) >= today) || [];
  const dailySwaps = todaysIntents.filter(i => i.status === "completed").length;
  const totalSwaps = allIntents?.filter(i => i.status === "completed").length || 0;
  const pendingIntents = allIntents?.filter(i => i.status === "pending").length || 0;
  const dailyVolume = todaysIntents?.filter(i => i.status === "completed").reduce((sum, i) => sum + Number(i.amount), 0) || 0;
  const totalVolume = allIntents?.filter(i => i.status === "completed").reduce((sum, i) => sum + Number(i.amount), 0) || 0;

  return {
    activeDevices: activeDevices || 0,
    dailySwaps,
    totalSwaps,
    pendingIntents,
    dailyVolume,
    totalVolume,
  };
}

export async function fetchRecentIntents(userId: string, limit = 5): Promise<Intent[]> {
  const { data, error } = await supabase
    .from("intents")
    .select("*, devices!inner(name, user_id)")
    .eq("devices.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
    
  return (data as Intent[]) || [];
}
