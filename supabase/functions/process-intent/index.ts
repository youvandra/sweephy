import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface SwapIntent {
  device_id: string;
  payload: string; // JSON string containing action, pair, amount, timestamp
  signature: string; // HMAC-SHA256 signature of payload using device_secret
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
    const { device_id, payload, signature }: SwapIntent = await req.json();

    if (!device_id || !payload || !signature) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // 1. Fetch Device & Secret
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*, profiles(*, rules(*), wallet_keys(*)), pairing_codes(*)")
      .eq("id", device_id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });
    }

    // 2. Verify HMAC Signature
    const isValid = await verifySignature(payload, signature, device.secret_hash);
    if (!isValid) {
      await logIntent(device_id, "rejected", "Invalid HMAC signature");
      return new Response(JSON.stringify({ error: "Invalid signature. Device secret mismatch." }), { status: 401 });
    }

    const data = JSON.parse(payload);
    const { action, pair, timestamp, pairing_code } = data;
    
    // Use amount from User Rules instead of payload (device doesn't decide amount)
    let amount = 0;
    if (action === "swap") {
      amount = Number(device.profiles.rules.swap_amount) || 50; // Fallback to 50 if rule missing
    }

    // 3. Replay Protection (Check timestamp within 60s window)
    const now = Date.now();
    if (Math.abs(now - timestamp) > 60000) {
      return new Response(JSON.stringify({ error: "Request expired (Replay protection)" }), { status: 400 });
    }

    // Update last seen (Heartbeat)
    await supabase.from("devices").update({ 
      last_seen: new Date().toISOString(),
      status: device.status === "disabled" ? "disabled" : "online"
    }).eq("id", device_id);

    // 4. Handle Status Check
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

      // 5. Enforce Allowance Rule
      if (!rules.allowance_granted) {
        await logIntent(device_id, "rejected", "Allowance not granted to KMS");
        return new Response(JSON.stringify({ error: "KMS signature requires allowance. Grant allowance in dashboard rules." }), { status: 403 });
      }

      // --- VERIFY ON-CHAIN ALLOWANCE (HEDERA MIRROR NODE) ---
      // In a real production environment, we MUST query the Mirror Node to confirm 
      // the user has actually granted allowance to our Platform KMS Account ID.
      // 
      // Example Query: 
      // GET https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/{user_address}/allowances/crypto
      // Check if `spender` matches our PLATFORM_KMS_ACCOUNT_ID and `amount` > intent.amount
      
      // For this PoC, we rely on the `allowance_granted` flag in our database, 
      // which is set only after the frontend confirms the transaction.
      // -------------------------------------------------------

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

      // 6. Fetch Swap Pair Config (SaucerSwap)
      const { data: pairConfig } = await supabase
        .from("swap_pairs")
        .select("*")
        .eq("pair_name", pair)
        .eq("is_active", true)
        .single();

      if (!pairConfig) {
        return new Response(JSON.stringify({ error: "Swap pair not supported or inactive" }), { status: 400 });
      }

      // 7. Create Intent Record
      const { data: intent, error: intentError } = await supabase
        .from("intents")
        .insert({ device_id, action, pair, amount, status: "pending" })
        .select()
        .single();

      if (intentError) throw intentError;

      // 8. Handle Signing via Global AWS KMS
      const AWS_KMS_KEY_ID = Deno.env.get("AWS_KMS_KEY_ID");
      
      if (AWS_KMS_KEY_ID) {
        // --- SAUCERSWAP TRANSACTION LOGIC (SIMULATED FOR POC) ---
        // 1. Fetch current price/slippage from SaucerSwap API if needed
        // 2. Build the contract call transaction for SaucerSwap Router
        // 3. Send the digest to AWS KMS to sign using the Global Platform Key
        // 4. Submit the signed transaction to Hedera Network
        
        const txHash = "0x" + Math.random().toString(16).slice(2); // Simulated Hedera TX Hash
        
        await supabase.from("intents").update({ status: "completed" }).eq("id", intent.id);
        await supabase.from("intent_logs").insert({
          intent_id: intent.id,
          tx_hash: txHash,
          signed_by: "kms",
          details: { 
            pair, 
            amount, 
            method: "KMS_CUSTODIAL_SAUCERSWAP", 
            kms_key: AWS_KMS_KEY_ID, // Using Global Key
            pool_id: pairConfig.saucerswap_pool_id,
            slippage: rules.slippage_tolerance
          }
        });

        return new Response(JSON.stringify({ status: "success", tx_hash: txHash }));
      } else {
        return new Response(JSON.stringify({ 
          error: "Platform KMS not configured"
        }), { status: 500 });
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
