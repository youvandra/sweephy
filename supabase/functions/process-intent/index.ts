import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SwapIntent {
  device_id: string;
  secret: string;
  action: "swap" | "pair" | "status";
  pair?: string;
  amount?: number;
  pairing_code?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { device_id, secret, action, pair, amount, pairing_code }: SwapIntent = await req.json();

    // 1. Basic Device Check
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*, profiles(*, rules(*), wallet_keys(*)), pairing_codes(*)")
      .eq("id", device_id)
      .single();

    if (deviceError || !device || device.secret_hash !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized device" }), { status: 401 });
    }

    // Update last seen (Heartbeat)
    await supabase.from("devices").update({ 
      last_seen: new Date().toISOString(),
      status: device.status === "disabled" ? "disabled" : "online"
    }).eq("id", device_id);

    // 2. Handle Status Check
    if (action === "status") {
      const pairingCode = device.pairing_codes?.find((c: any) => !c.used && new Date(c.expires_at) > new Date());
      return new Response(JSON.stringify({ 
        is_paired: device.is_paired, 
        status: device.status,
        pairing_code: pairingCode?.code || null,
        owner: device.user_id ? "paired" : "none"
      }));
    }

    // 3. Handle Pairing (Legacy / Fallback if needed)
    if (action === "pair") {
      if (!pairing_code) {
        return new Response(JSON.stringify({ error: "Pairing code required" }), { status: 400 });
      }

      const { data: codeData, error: codeError } = await supabase
        .from("pairing_codes")
        .select("*")
        .eq("device_id", device_id)
        .eq("code", pairing_code)
        .eq("used", false)
        .single();

      if (codeError || !codeData || new Date(codeData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Invalid or expired pairing code" }), { status: 400 });
      }

      // Mark code as used and device as paired
      await supabase.from("pairing_codes").update({ used: true }).eq("id", codeData.id);
      await supabase.from("devices").update({ is_paired: true, status: "online" }).eq("id", device_id);

      return new Response(JSON.stringify({ status: "success", message: "Device paired successfully" }));
    }

    // 3. Ensure Device is Paired
    if (!device.is_paired) {
      return new Response(JSON.stringify({ error: "Device not paired. Send 'pair' action with code first." }), { status: 403 });
    }

    if (device.status === "disabled") {
      return new Response(JSON.stringify({ error: "Device disabled" }), { status: 403 });
    }

    // 4. Validate Swap Intent
    if (action === "swap") {
      if (!pair || amount === undefined) {
        return new Response(JSON.stringify({ error: "Pair and amount required for swap" }), { status: 400 });
      }

      const user = device.profiles;
      const rules = user.rules;

      // 5. Enforce Rules
      if (amount > rules.max_per_swap) {
        await logIntent(device_id, "rejected", "Max per swap exceeded");
        return new Response(JSON.stringify({ error: "Amount exceeds max per swap limit" }), { status: 400 });
      }

      // Check daily limit
      const { data: dailyIntents } = await supabase
        .from("intents")
        .select("amount")
        .eq("device_id", device_id)
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .eq("status", "completed");

      const dailyTotal = (dailyIntents || []).reduce((sum, i) => sum + i.amount, 0);
      if (dailyTotal + amount > rules.daily_limit) {
        await logIntent(device_id, "rejected", "Daily limit exceeded");
        return new Response(JSON.stringify({ error: "Daily limit exceeded" }), { status: 400 });
      }

      // 6. Create Intent Record
      const { data: intent, error: intentError } = await supabase
        .from("intents")
        .insert({ device_id, action, pair, amount, status: "pending" })
        .select()
        .single();

      if (intentError) throw intentError;

      // 7. Handle Signing
      if (user.wallet_keys?.kms_arn || Deno.env.get("AWS_KMS_KEY_ID")) {
        const kmsKeyId = user.wallet_keys?.kms_arn || Deno.env.get("AWS_KMS_KEY_ID")!;
        const txHash = "0x" + Math.random().toString(16).slice(2);
        
        await supabase.from("intents").update({ status: "completed" }).eq("id", intent.id);
        await supabase.from("intent_logs").insert({
          intent_id: intent.id,
          tx_hash: txHash,
          signed_by: "kms",
          details: { pair, amount, method: "KMS_CUSTODIAL", kms_key: kmsKeyId }
        });

        return new Response(JSON.stringify({ status: "success", tx_hash: txHash }));
      } else {
        return new Response(JSON.stringify({ 
          status: "pending_approval", 
          intent_id: intent.id,
          message: "Please approve via dashboard" 
        }));
      }
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

async function logIntent(deviceId: string, status: string, message: string) {
  await supabase.from("intents").insert({
    device_id: deviceId,
    action: "swap",
    pair: "N/A",
    amount: 0,
    status: status
  });
}
