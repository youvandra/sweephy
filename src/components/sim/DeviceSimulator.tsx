 "use client";
 
 import { useEffect, useMemo, useRef, useState } from "react";
 
 type Screen =
   | "SETUP"
   | "CONNECTING"
   | "UNPAIRED"
   | "READY"
   | "PRICE_HIT"
   | "CONFIRM_SWAP"
   | "SWAPPING"
   | "SWAP_SUCCESS"
   | "SWAP_FAIL";
 
 const LONG_PRESS_TIME_MS = 1000;
 const SWAP_RESULT_TIMEOUT_MS = 3000;
 const PRICE_HIT_TIMEOUT_MS = 10000;
 
 function clamp(value: number, min: number, max: number) {
   return Math.min(max, Math.max(min, value));
 }
 
 function formatPrice(value: number) {
   if (!Number.isFinite(value)) return "0.00000";
   return value.toFixed(5);
 }
 
 function computeLinePath(values: number[], width: number, height: number, padding = 6) {
   if (values.length < 2) return "";
   const min = Math.min(...values);
   const max = Math.max(...values);
   const range = max - min || 1;
   const innerW = Math.max(1, width - padding * 2);
   const innerH = Math.max(1, height - padding * 2);
 
   return values
     .map((v, i) => {
       const x = padding + (i / (values.length - 1)) * innerW;
       const y = padding + (1 - (v - min) / range) * innerH;
       return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
     })
     .join(" ");
 }
 
 async function fetchKlines(interval: string, limit: number) {
   const res = await fetch(`/api/price-history?interval=${interval}&limit=${limit}`);
   if (!res.ok) throw new Error("Failed to fetch price");
   return (await res.json()) as Array<[number, string, string, string, string, string, number, string, number, string, string, string]>;
 }
 
 export function DeviceSimulator() {
   const [screen, setScreen] = useState<Screen>("READY");
   const [isPaired, setIsPaired] = useState(true);
   const [pairingCode, setPairingCode] = useState("842193");
   const [statusLine, setStatusLine] = useState("READY");
 
   const [currentPrice, setCurrentPrice] = useState(0.0);
   const [prevPrice, setPrevPrice] = useState(0.0);
   const [priceHistory, setPriceHistory] = useState<number[]>([]);
 
   const [triggerPrice, setTriggerPrice] = useState<number | null>(null);
   const [triggerHit, setTriggerHit] = useState(false);
 
   const [forceSwapFail, setForceSwapFail] = useState(false);
   const [useLivePrice, setUseLivePrice] = useState(true);
   const [manualPrice, setManualPrice] = useState(0.0985);
 
   const pressStartRef = useRef<number | null>(null);
   const pressRafRef = useRef<number | null>(null);
   const [pressProgress, setPressProgress] = useState(0);
 
   const priceHitStartRef = useRef<number | null>(null);
   const swapResultTimerRef = useRef<number | null>(null);
   const priceHitTimerRef = useRef<number | null>(null);
 
   const lastPriceStr = useMemo(() => formatPrice(currentPrice), [currentPrice]);
   const pctChange = useMemo(() => {
     if (!Number.isFinite(prevPrice) || prevPrice === 0) return 0;
     return ((currentPrice - prevPrice) / prevPrice) * 100;
   }, [currentPrice, prevPrice]);
 
   const chart = useMemo(() => {
     const width = 196;
     const height = 64;
     const path = computeLinePath(priceHistory.slice(-48), width, height, 6);
     const isUp = priceHistory.length > 1 ? priceHistory[priceHistory.length - 1] >= priceHistory[0] : true;
     return { width, height, path, isUp };
   }, [priceHistory]);
 
  const applyPriceUpdate = (nextPrice: number, nextHistory?: number[]) => {
    const price = Number.isFinite(nextPrice) ? nextPrice : 0;
    setPrevPrice((p) => (p === 0 ? price : currentPrice));
    setCurrentPrice(price);
    if (nextHistory && nextHistory.length > 1) setPriceHistory(nextHistory);
    else setPriceHistory((prev) => [...prev.slice(-95), price]);

    if (triggerPrice == null || triggerPrice <= 0) {
      if (triggerHit) setTriggerHit(false);
      return;
    }

    if (triggerHit && price > triggerPrice) {
      setTriggerHit(false);
      return;
    }

    if (!triggerHit && screen === "READY" && price <= triggerPrice) {
      setTriggerHit(true);
      setScreen("PRICE_HIT");
      setStatusLine("PRICE HIT");
      priceHitStartRef.current = Date.now();
      if (priceHitTimerRef.current) window.clearTimeout(priceHitTimerRef.current);
      priceHitTimerRef.current = window.setTimeout(() => {
        setScreen("READY");
        setStatusLine("READY");
        priceHitStartRef.current = null;
      }, PRICE_HIT_TIMEOUT_MS);
    }
  };
 
   useEffect(() => {
    if (!useLivePrice) return;
 
     let cancelled = false;
 
     const load = async () => {
       try {
         const klines = await fetchKlines("1m", 96);
         if (cancelled) return;
         const closes = klines.map((k) => Number.parseFloat(k[4]));
         const nextPrice = closes[closes.length - 1] ?? 0;
        applyPriceUpdate(nextPrice, closes);
       } catch {
       }
     };
 
     void load();
     const id = window.setInterval(load, 15000);
     return () => {
       cancelled = true;
       window.clearInterval(id);
     };
  }, [useLivePrice, currentPrice, screen, triggerPrice, triggerHit]);
 
   useEffect(() => {
     return () => {
       if (swapResultTimerRef.current) window.clearTimeout(swapResultTimerRef.current);
       if (priceHitTimerRef.current) window.clearTimeout(priceHitTimerRef.current);
       if (pressRafRef.current) cancelAnimationFrame(pressRafRef.current);
     };
   }, []);
 
   const startSwap = () => {
     setScreen("SWAPPING");
     setStatusLine("Swapping..");
 
     const start = Date.now();
     const tick = () => {
       const elapsed = Date.now() - start;
       const dots = ".".repeat(((elapsed / 350) | 0) % 4);
       setStatusLine(`Swapping${dots}`);
     };
 
     const dotsId = window.setInterval(tick, 200);
     const done = () => {
       window.clearInterval(dotsId);
       const ok = !forceSwapFail;
       setScreen(ok ? "SWAP_SUCCESS" : "SWAP_FAIL");
       setStatusLine(ok ? "SUCCESS" : "FAILED");
       if (swapResultTimerRef.current) window.clearTimeout(swapResultTimerRef.current);
       swapResultTimerRef.current = window.setTimeout(() => {
         setScreen("READY");
         setStatusLine("READY");
       }, SWAP_RESULT_TIMEOUT_MS);
     };
 
     window.setTimeout(done, 2200);
   };
 
   const beginPress = () => {
     if (screen === "PRICE_HIT") {
       setScreen("READY");
       setStatusLine("READY");
       if (priceHitTimerRef.current) window.clearTimeout(priceHitTimerRef.current);
       priceHitStartRef.current = null;
       return;
     }
     if (screen !== "READY") return;
 
     pressStartRef.current = Date.now();
     setPressProgress(0);
     setScreen("CONFIRM_SWAP");
     setStatusLine("CONFIRM SWAP?");
 
     const step = () => {
       const start = pressStartRef.current;
       if (!start) return;
       const elapsed = Date.now() - start;
       const progress = clamp(elapsed / LONG_PRESS_TIME_MS, 0, 1);
       setPressProgress(progress);
       if (elapsed >= LONG_PRESS_TIME_MS) {
         pressStartRef.current = null;
         setPressProgress(1);
         startSwap();
         return;
       }
       pressRafRef.current = requestAnimationFrame(step);
     };
     pressRafRef.current = requestAnimationFrame(step);
   };
 
   const endPress = () => {
     if (screen !== "CONFIRM_SWAP") return;
     if (pressStartRef.current) {
       pressStartRef.current = null;
       setPressProgress(0);
       setScreen("READY");
       setStatusLine("READY");
     }
     if (pressRafRef.current) cancelAnimationFrame(pressRafRef.current);
     pressRafRef.current = null;
   };
 
   const header = useMemo(() => {
     if (screen === "SETUP") return "SETUP MODE";
     if (screen === "CONNECTING") return "CONNECTING";
     if (screen === "UNPAIRED") return "UNPAIRED";
     if (screen === "PRICE_HIT") return "PRICE HIT";
     if (screen === "SWAPPING") return "SWAPPING";
     if (screen === "SWAP_SUCCESS") return "SWAP SUCCESS";
     if (screen === "SWAP_FAIL") return "SWAP FAIL";
     return "HBAR / USDC";
   }, [screen]);
 
   const bottomBarLabel = useMemo(() => {
     if (screen === "PRICE_HIT") return "PRESS TO ACK";
     if (screen === "READY") return "HOLD TO SWAP";
     if (screen === "CONFIRM_SWAP") return pressProgress >= 0.9 ? "RELEASE TO SWAP" : "RELEASE TO CANCEL";
     return "";
   }, [screen, pressProgress]);
 
   return (
     <div className="w-full flex flex-col lg:flex-row gap-10 items-start">
       <div className="w-full lg:w-[520px]">
         <div className="rounded-[36px] bg-black p-6 border border-white/10 shadow-2xl">
           <div className="rounded-[28px] bg-[#021B1A] border border-white/10 overflow-hidden">
             <div className="h-[260px] flex flex-col items-center justify-between px-6 py-5">
               <div className="w-full flex items-center justify-between">
                 <div className="text-xs font-bold tracking-widest text-primary">{header}</div>
                 <div className="text-[10px] font-mono uppercase tracking-widest text-white/60">{statusLine}</div>
               </div>
 
               {screen === "UNPAIRED" && (
                 <div className="flex flex-col items-center gap-3">
                   <div className="text-4xl font-bold tracking-widest text-white">{pairingCode}</div>
                   <div className="text-xs font-bold tracking-widest uppercase text-white/60">Pairing Code</div>
                 </div>
               )}
 
               {screen === "READY" && (
                 <div className="w-full flex flex-col items-center">
                   <div className="text-4xl font-bold text-white">${lastPriceStr}</div>
                   <div className={`mt-1 text-sm font-bold ${pctChange >= 0 ? "text-red-400" : "text-primary"}`}>
                     {(pctChange >= 0 ? "+" : "") + pctChange.toFixed(2)}%
                   </div>
                   {triggerPrice != null && triggerPrice > 0 && (
                     <div className="mt-3 text-[10px] font-bold tracking-widest text-white/70">
                       TRIGGER ${formatPrice(triggerPrice)}
                     </div>
                   )}
                   <div className="mt-4 w-full flex items-center justify-center">
                     <svg width={chart.width} height={chart.height} className="opacity-90">
                       <path d={chart.path} fill="none" stroke={chart.isUp ? "#00DF81" : "#ff4d4d"} strokeWidth="2" />
                     </svg>
                   </div>
                 </div>
               )}
 
               {screen === "PRICE_HIT" && (
                 <div className="w-full flex flex-col items-center">
                   <div className="text-4xl font-bold text-white">${lastPriceStr}</div>
                   {triggerPrice != null && triggerPrice > 0 && (
                     <div className="mt-3 text-xs font-bold tracking-widest text-white/70">
                       TARGET ${formatPrice(triggerPrice)}
                     </div>
                   )}
                   <div className="mt-4 text-[10px] font-mono uppercase tracking-widest text-white/50">
                     Auto close in 10s
                   </div>
                 </div>
               )}
 
               {screen === "CONFIRM_SWAP" && (
                 <div className="w-full flex flex-col items-center">
                   <div className="text-2xl font-bold text-red-400">CONFIRM SWAP?</div>
                   <div className="mt-2 text-2xl font-bold text-white">${lastPriceStr}</div>
                   <div className="mt-6 w-full max-w-[220px]">
                     <div className="h-6 w-full rounded-md border border-white/30 p-0.5">
                       <div
                         className="h-full rounded-[4px] bg-white"
                         style={{ width: `${Math.round(pressProgress * 100)}%` }}
                       />
                     </div>
                   </div>
                   <div className={`mt-5 text-xs font-bold tracking-widest ${pressProgress >= 0.9 ? "text-red-400" : "text-primary"}`}>
                     {pressProgress >= 0.9 ? "RELEASE TO SWAP" : "RELEASE TO CANCEL"}
                   </div>
                 </div>
               )}
 
               {screen === "SWAPPING" && (
                 <div className="w-full flex flex-col items-center">
                   <div className="text-3xl font-bold text-white">{statusLine}</div>
                   <div className="mt-3 text-xs text-white/60">Executing swap workflow</div>
                 </div>
               )}
 
               {screen === "SWAP_SUCCESS" && (
                 <div className="w-full flex flex-col items-center">
                   <div className="text-3xl font-bold text-primary">SUCCESS</div>
                   <div className="mt-3 text-xs text-white/70">Swap completed</div>
                 </div>
               )}
 
               {screen === "SWAP_FAIL" && (
                 <div className="w-full flex flex-col items-center">
                   <div className="text-3xl font-bold text-red-400">FAILED</div>
                   <div className="mt-3 text-xs text-white/70">Swap failed</div>
                 </div>
               )}
 
               <div className="w-full">
                 {bottomBarLabel ? (
                   <div
                     className={`w-full rounded-xl py-3 text-center text-sm font-bold tracking-widest ${
                       screen === "PRICE_HIT" || screen === "READY" || screen === "CONFIRM_SWAP"
                         ? "bg-red-500 text-white"
                         : "bg-transparent text-transparent"
                     }`}
                     onPointerDown={beginPress}
                     onPointerUp={endPress}
                     onPointerCancel={endPress}
                     onPointerLeave={endPress}
                   >
                     {bottomBarLabel}
                   </div>
                 ) : (
                   <div className="h-12" />
                 )}
               </div>
             </div>
           </div>
         </div>
       </div>
 
       <div className="w-full lg:flex-1">
         <details className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
           <summary className="cursor-pointer select-none px-6 py-4 font-bold text-secondary">Controls</summary>
           <div className="px-6 pb-6 grid gap-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <label className="flex items-center justify-between gap-4 bg-gray-50 rounded-2xl px-4 py-3">
                 <span className="text-sm font-bold text-secondary">Paired</span>
                <input
                  type="checkbox"
                  checked={isPaired}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsPaired(next);
                    if (!next) {
                      setScreen("UNPAIRED");
                      setStatusLine("PAIR DEVICE");
                      return;
                    }
                    setScreen("READY");
                    setStatusLine("READY");
                  }}
                />
               </label>
               <label className="flex items-center justify-between gap-4 bg-gray-50 rounded-2xl px-4 py-3">
                 <span className="text-sm font-bold text-secondary">Force Swap Fail</span>
                 <input type="checkbox" checked={forceSwapFail} onChange={(e) => setForceSwapFail(e.target.checked)} />
               </label>
             </div>
 
             {!isPaired && (
               <label className="grid gap-2">
                 <span className="text-sm font-bold text-secondary">Pairing Code</span>
                 <input
                   className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-bold text-secondary"
                   value={pairingCode}
                   onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                 />
               </label>
             )}
 
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <label className="flex items-center justify-between gap-4 bg-gray-50 rounded-2xl px-4 py-3">
                 <span className="text-sm font-bold text-secondary">Live Price</span>
                <input
                  type="checkbox"
                  checked={useLivePrice}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setUseLivePrice(next);
                    if (!next) applyPriceUpdate(manualPrice);
                  }}
                />
               </label>
               <label className="grid gap-2">
                 <span className="text-sm font-bold text-secondary">Manual Price</span>
                 <input
                   className="w-full px-4 py-3 rounded-2xl border border-gray-200 font-bold text-secondary disabled:bg-gray-100"
                   value={manualPrice}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setManualPrice(n);
                    if (!useLivePrice) applyPriceUpdate(n);
                  }}
                   type="number"
                   step="0.00001"
                   disabled={useLivePrice}
                 />
               </label>
             </div>
 
             <label className="grid gap-2">
               <span className="text-sm font-bold text-secondary">Trigger Price (alert when price ≤ target)</span>
               <div className="flex gap-3">
                 <input
                   className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 font-bold text-secondary"
                   value={triggerPrice == null ? "" : String(triggerPrice)}
                   onChange={(e) => {
                     const v = e.target.value.trim();
                     if (v.length === 0) {
                       setTriggerPrice(null);
                       setTriggerHit(false);
                       return;
                     }
                     const n = Number(v.replace(",", "."));
                     setTriggerPrice(Number.isFinite(n) ? n : null);
                     setTriggerHit(false);
                   }}
                   inputMode="decimal"
                   placeholder="0.09850"
                 />
                 <button
                   className="px-5 py-3 rounded-2xl bg-secondary text-white font-bold"
                   onClick={() => {
                     setTriggerPrice(null);
                     setTriggerHit(false);
                     setScreen(isPaired ? "READY" : "UNPAIRED");
                     setStatusLine(isPaired ? "READY" : "PAIR DEVICE");
                   }}
                   type="button"
                 >
                   Clear
                 </button>
               </div>
             </label>
 
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               <button
                 type="button"
                 className="px-4 py-3 rounded-2xl bg-gray-100 text-secondary font-bold"
                 onClick={() => {
                   setScreen("READY");
                   setStatusLine("READY");
                 }}
               >
                 Ready
               </button>
               <button
                 type="button"
                 className="px-4 py-3 rounded-2xl bg-gray-100 text-secondary font-bold"
                 onClick={() => {
                   setScreen("UNPAIRED");
                   setStatusLine("PAIR DEVICE");
                   setIsPaired(false);
                 }}
               >
                 Unpaired
               </button>
               <button
                 type="button"
                 className="px-4 py-3 rounded-2xl bg-gray-100 text-secondary font-bold"
                 onClick={() => {
                   setScreen("PRICE_HIT");
                   setStatusLine("PRICE HIT");
                   priceHitStartRef.current = Date.now();
                   if (priceHitTimerRef.current) window.clearTimeout(priceHitTimerRef.current);
                   priceHitTimerRef.current = window.setTimeout(() => {
                     setScreen("READY");
                     setStatusLine("READY");
                     priceHitStartRef.current = null;
                   }, PRICE_HIT_TIMEOUT_MS);
                 }}
               >
                 Price Hit
               </button>
               <button
                 type="button"
                 className="px-4 py-3 rounded-2xl bg-gray-100 text-secondary font-bold"
                 onClick={startSwap}
               >
                 Swap
               </button>
             </div>
           </div>
         </details>
       </div>
     </div>
   );
 }
