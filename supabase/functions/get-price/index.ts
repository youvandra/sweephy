import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    // Fetch HBAR Price from CoinGecko
    let price = "0.00000";
    try {
      const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd&precision=5");
      if (priceRes.ok) {
          const priceData = await priceRes.json();
          const rawPrice = priceData["hedera-hashgraph"].usd;
          price = Number(rawPrice).toFixed(5);
      }
    } catch (err) {
      console.error("Price fetch error:", err);
    }

    return new Response(JSON.stringify({ 
      pair: "HBAR/USDC",
      price: price,
      timestamp: Date.now()
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
