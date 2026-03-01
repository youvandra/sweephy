import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface StatusRequest {
  device_id: string;
  signature: string; // HMAC-SHA256 of device_id (simple auth)
}

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const signatureBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const payloadBytes = new TextEncoder().encode(payload);
  
  return await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { device_id, signature }: StatusRequest = await req.json();

    if (!device_id || !signature) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // 1. Fetch Device
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*, profiles(*), pairing_codes(*)")
      .eq("id", device_id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });
    }

    // 2. Verify Signature
    const isValid = await verifySignature(device_id, signature, device.secret_hash);
    if (!isValid) {
      // In strict mode, we'd fail here. 
      // But for debugging, we might skip this if the user hasn't synced secrets perfectly.
      // Let's enforce it.
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    // 3. Update Heartbeat
    await supabase.from("devices").update({ 
      last_seen: new Date().toISOString(),
      status: "online"
    }).eq("id", device_id);

    // 4. Handle Pairing Code Logic
    let pairingCode = device.pairing_codes?.find((c: any) => !c.used && new Date(c.expires_at) > new Date())?.code;
    
    if (!device.is_paired && !pairingCode) {
        // Generate new pairing code
        const newCode = Math.random().toString(36).slice(-6).toUpperCase();
        const { error: codeError } = await supabase.from("pairing_codes").insert({
          code: newCode,
          device_id: device_id,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins
        });
        if (!codeError) pairingCode = newCode;
    }

    return new Response(JSON.stringify({ 
      is_paired: device.is_paired, 
      status: device.status,
      pairing_code: pairingCode || null
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
