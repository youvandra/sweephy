import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    // Fetch HBAR/USDC Price from Binance
    let price = "0.00000";
    try {
      const priceRes = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=HBARUSDC");
      if (priceRes.ok) {
          const priceData = await priceRes.json();
          // priceData format: {"symbol":"HBARUSDC","price":"0.10243000"}
          const rawPrice = priceData.price;
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
