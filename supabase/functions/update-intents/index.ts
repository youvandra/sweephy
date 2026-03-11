
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MIRROR_NODE_API = "https://mainnet-public.mirrornode.hedera.com";

function toMirrorNodeTransactionId(txId: string): string {
  const at = txId.indexOf("@");
  if (at === -1) return txId;
  const account = txId.slice(0, at);
  const validStart = txId.slice(at + 1);
  const dot = validStart.indexOf(".");
  if (dot === -1) return `${account}-${validStart}`;
  const seconds = validStart.slice(0, dot);
  const nanos = validStart.slice(dot + 1).padStart(9, "0");
  return `${account}-${seconds}-${nanos}`;
}

async function fetchMirrorTxResult(mirrorTxId: string): Promise<{ found: boolean; result?: string }> {
  const res = await fetch(`${MIRROR_NODE_API}/api/v1/transactions/${mirrorTxId}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (res.status === 404) return { found: false };
  if (!res.ok) return { found: false };

  const data = await res.json();
  const result = data?.transactions?.[0]?.result as string | undefined;
  if (!result) return { found: false };
  return { found: true, result };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: intents, error } = await supabase
      .from("intents")
      .select("id, status, tx_id")
      .in("status", ["processing"])
      .not("tx_id", "is", null)
      .neq("tx_id", "pending")
      .neq("tx_id", "failed");

    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];

    for (const intent of intents || []) {
      try {
        const mirrorTxId = toMirrorNodeTransactionId(intent.tx_id);
        const { found, result } = await fetchMirrorTxResult(mirrorTxId);

        if (!found) {
          results.push({ id: intent.id, status: "still_processing" });
          continue;
        }

        const nextStatus = result === "SUCCESS" ? "completed" : "failed";
        await supabase
          .from("intents")
          .update({
            status: nextStatus,
            tx_id_receipt: mirrorTxId,
            note: `Mirror node result: ${result}`,
          })
          .eq("id", intent.id);

        results.push({ id: intent.id, status: nextStatus, result });
      } catch (e: unknown) {
        results.push({ id: intent.id, error: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), { status: 500 });
  }
});
