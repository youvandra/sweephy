
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ethers } from "https://esm.sh/ethers@5.7.2?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Hedera Mainnet
const RPC_URL = "https://mainnet.hashio.io/api";
const CHAIN_ID = 295;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL, CHAIN_ID);

    // 1. Fetch Pending Intents
    const { data: intents, error } = await supabase
      .from("intents")
      .select("*")
      .eq("status", "pending")
      .not("tx_id", "is", null);

    if (error) throw error;
    
    const results = [];

    for (const intent of intents) {
       try {
           console.log(`Checking tx: ${intent.tx_id}`);
           const receipt = await provider.getTransactionReceipt(intent.tx_id);
           
           if (receipt) {
               const status = receipt.status === 1 ? "completed" : "failed";
               
               // Update Intent
               await supabase.from("intents").update({ status }).eq("id", intent.id);
               
               // Update Log
               await supabase.from("intent_logs").insert({
                   intent_id: intent.id,
                   tx_hash: intent.tx_id,
                   signed_by: "system_update",
                   details: {
                       status: status,
                       blockNumber: receipt.blockNumber,
                       gasUsed: receipt.gasUsed.toString()
                   }
               });
               
               results.push({ id: intent.id, status });
           } else {
               // Check if tx is too old (e.g. > 1 hour) and mark failed? 
               // For now, leave as pending.
               results.push({ id: intent.id, status: "still_pending" });
           }
       } catch (e) {
           console.error(`Error checking tx ${intent.tx_id}:`, e);
           results.push({ id: intent.id, error: e.message });
       }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});