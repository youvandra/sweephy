import { supabase } from "@/lib/supabase";

export async function fetchAuditLogs(
  userId: string, 
  page: number, 
  pageSize: number, 
  filters: { status: string; deviceId: string; date: string; search: string }
) {
  // 1. Resolve Device IDs based on filter
  let deviceIds: string[] = [];
  if (filters.deviceId !== 'all') {
    deviceIds = [filters.deviceId];
  } else {
    const { data: userDevices } = await supabase.from('devices').select('id').eq('user_id', userId);
    deviceIds = userDevices?.map(d => d.id) || [];
  }
  
  if (deviceIds.length === 0) {
    return { data: [], count: 0 };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("intents")
    .select("*, devices(name)", { count: 'exact' })
    .in('device_id', deviceIds)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`tx_id.ilike.%${filters.search}%,pair.ilike.%${filters.search}%`);
  }

  if (filters.date) {
    const startDate = new Date(filters.date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(filters.date);
    endDate.setHours(23, 59, 59, 999);
    query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { data: data || [], count: count || 0 };
}

export async function fetchUserDevices(userId: string) {
  const { data } = await supabase.from('devices').select('id, name').eq('user_id', userId);
  return data || [];
}
