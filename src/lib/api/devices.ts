import { supabase } from "@/lib/supabase";

export async function fetchDevices(userId: string) {
  const { data } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function toggleDeviceStatus(deviceId: string, isDisabled: boolean) {
  return await supabase
    .from("devices")
    .update({ is_disabled: isDisabled })
    .eq("id", deviceId);
}

export async function deleteDevice(deviceId: string) {
  return await supabase
    .from("devices")
    .update({ user_id: null, is_paired: false, status: "offline" })
    .eq("id", deviceId);
}

export async function renameDevice(deviceId: string, newName: string) {
  return await supabase
    .from("devices")
    .update({ name: newName.trim() })
    .eq("id", deviceId);
}

export async function claimDevice(userId: string, pairingCode: string) {
  const { data: codeData, error: codeError } = await supabase
    .from("pairing_codes")
    .select("*, devices(*)")
    .eq("code", pairingCode.toUpperCase())
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
    
  return true;
}
