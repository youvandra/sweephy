"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceDot,
  Brush
} from "recharts";
import { Intent } from "@/lib/api/dashboard";
import { format } from "date-fns";
import { Loader2, TrendingUp, TrendingDown, X, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { formatError } from "@/lib/format-error";

interface TradingChartProps {
  intents: Intent[];
}

interface PriceData {
  time: number;
  price: number;
  dateStr: string;
}

type TimeFrame = '1D' | '1W' | '1M' | '1Y';

interface EnrichedIntent extends Intent {
  executionPrice: number;
}

type Kline = [number, string, string, string, string, ...unknown[]];

type CustomDotProps = {
  cx?: number;
  cy?: number;
  payload?: PriceData;
};

type TooltipPayloadItem = { value: number };

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
};

export function TradingChart({ intents }: TradingChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1W');
  const [selectedPoint, setSelectedPoint] = useState<{ dateStr: string; amount: number; intents: EnrichedIntent[] } | null>(null);

  useEffect(() => {
    async function fetchPriceData() {
      setLoading(true);
      try {
        let interval = '1h';
        let limit = '168'; // Default 7 days (1W)

        switch (timeFrame) {
          case '1D':
            interval = '15m';
            limit = '96';
            break;
          case '1W':
            interval = '1h';
            limit = '168';
            break;
          case '1M':
            interval = '4h';
            limit = '180';
            break;
          case '1Y':
            interval = '1d';
            limit = '365';
            break;
        }

        const response = await fetch(`/api/price-history?interval=${interval}&limit=${limit}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch price data");
        }
        
        const klines: unknown = await response.json();
        
        // Handle potential error from API route
        if (typeof klines === "object" && klines !== null && "error" in klines) {
          const err = (klines as { error?: unknown }).error;
          throw new Error(typeof err === "string" ? err : "Failed to fetch price data");
        }
        if (!Array.isArray(klines)) {
          throw new Error("Invalid price data");
        }

        const formattedData = (klines as Kline[]).map((k) => ({
          time: k[0],
          price: parseFloat(k[4]),
          dateStr: format(new Date(k[0]), timeFrame === '1D' ? "HH:mm" : "MMM dd"),
        }));

        setData(formattedData);
        
        if (formattedData.length > 0) {
          const lastPrice = formattedData[formattedData.length - 1].price;
          const firstPrice = formattedData[0].price;
          setCurrentPrice(lastPrice);
          setPriceChange(((lastPrice - firstPrice) / firstPrice) * 100);
        }
      } catch (error) {
        console.error(`Failed to fetch price data: ${formatError(error)}`);
      } finally {
        setLoading(false);
      }
    }

    fetchPriceData();
  }, [timeFrame]);

  // Pre-calculate aggregated intents per chart data point
  const aggregatedIntents = useMemo(() => {
    if (data.length === 0) return new Map<string, { amount: number, intents: EnrichedIntent[] }>();
    
    const intentMap = new Map<string, { amount: number, intents: EnrichedIntent[] }>();
    const startTime = data[0].time;
    const endTime = data[data.length - 1].time;

    intents.filter(intent => {
      // Ensure date parsing works correctly for ISO strings or timestamps
      const intentTime = new Date(intent.created_at).getTime();
      const isCompleted = intent.status === "completed";
      const hasSwapTx = !!intent.tx_id_swap && intent.tx_id_swap !== "pending" && intent.tx_id_swap !== "failed";
      return intentTime >= startTime && intentTime <= endTime && intent.action === "swap" && isCompleted && hasSwapTx;
    }).forEach(intent => {
      const intentTime = new Date(intent.created_at).getTime();
      // Find closest data point
      const closestPoint = data.reduce((prev, curr) => 
        Math.abs(curr.time - intentTime) < Math.abs(prev.time - intentTime) ? curr : prev
      );
      
      const enrichedIntent: EnrichedIntent = { ...intent, executionPrice: closestPoint.price };
      const current = intentMap.get(closestPoint.dateStr) || { amount: 0, intents: [] };
      
      intentMap.set(closestPoint.dateStr, {
        amount: current.amount + 1, // Count transactions instead of summing amounts
        intents: [...current.intents, enrichedIntent]
      });
    });

    return intentMap;
  }, [data, intents]);

  const CustomDot = (props: CustomDotProps) => {
    const { cx, cy, payload } = props;
    
    // Only render if we have valid coordinates and payload
    if (!cx || !cy || !payload || !payload.dateStr) return null;

    // Check if we have aggregated data for this point
    const aggregatedData = aggregatedIntents.get(payload.dateStr);
    
    // If no transaction here, return standard empty dot or null (to show just the line)
    if (!aggregatedData || aggregatedData.amount === 0) return <circle cx={cx} cy={cy} r={0} />;

    return (
      <svg x={cx - 14} y={cy - 14} width={28} height={28} viewBox="0 0 28 28" style={{ overflow: 'visible' }}>
        <g 
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPoint({
              dateStr: payload.dateStr,
              amount: aggregatedData.amount,
              intents: aggregatedData.intents
            });
          }}
        >
          <circle cx={14} cy={14} r={14} fill="#00DF81" stroke="#fff" strokeWidth={2} />
          <text 
            x={14} 
            y={19} 
            textAnchor="middle" 
            fill="#021B1A" 
            fontSize={10} 
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {Math.round(aggregatedData.amount) > 99 ? '99+' : Math.round(aggregatedData.amount)}
          </text>
        </g>
      </svg>
    );
  };

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#021B1A] border border-white/10 p-3 rounded-xl shadow-xl">
          <p className="text-gray-400 text-xs mb-1">{label}</p>
          <p className="text-white font-bold text-sm">
            ${payload[0].value.toFixed(4)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[500px] w-full bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm overflow-hidden flex flex-col relative">
      <AnimatePresence>
        {selectedPoint && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute z-50 top-20 left-1/2 -translate-x-1/2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          >
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-secondary text-sm">Transaction Details</h4>
                <p className="text-[10px] text-gray-400 font-medium">{selectedPoint.dateStr}</p>
              </div>
              <button 
                onClick={() => setSelectedPoint(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 max-h-60 overflow-y-auto space-y-3 custom-scrollbar">
              {selectedPoint.intents.map((intent) => (
                <div key={intent.id} className="flex flex-col gap-2 p-3 rounded-xl bg-gray-50/50 border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timestamp</span>
                    <span className="text-xs font-bold text-secondary">{new Date(intent.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</span>
                    <span className="text-xs font-bold text-secondary">{Number(intent.amount).toLocaleString()} HBAR</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount Receive</span>
                    <span className="text-xs font-bold text-secondary">~{(Number(intent.amount) * intent.executionPrice).toFixed(2)} USDC</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Device</span>
                    <span className="text-xs font-bold text-secondary">{intent.devices?.name}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              <Link href="/dashboard/audit" className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:text-secondary hover:border-gray-300 transition-colors shadow-sm">
                View Full Logs
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-secondary">HBAR / USDC</h3>
            <div className="flex bg-gray-50 rounded-lg p-1">
              {(['1D', '1W', '1M', '1Y'] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    timeFrame === tf 
                      ? "bg-white text-secondary shadow-sm" 
                      : "text-gray-400 hover:text-secondary"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1">
            <h2 className="text-3xl font-bold text-secondary">
              ${currentPrice.toFixed(4)}
            </h2>
            <div className={`flex items-center gap-1 text-sm font-bold ${priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
              {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.abs(priceChange).toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
           <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Your Buys
           </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00DF81" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00DF81" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="dateStr" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                minTickGap={50}
              />
              <YAxis 
                domain={['auto', 'auto']}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickFormatter={(val) => `$${val.toFixed(4)}`}
                orientation="right"
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Use Customized Dot on Area instead for proper per-point rendering */}
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#00DF81" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                activeDot={{ r: 6, fill: "#00DF81", stroke: "#fff", strokeWidth: 2 }}
                dot={(props: unknown) => <CustomDot {...(props as CustomDotProps)} />}
              />
              <Brush 
                dataKey="dateStr" 
                height={30} 
                stroke="#00DF81"
                fill="#f8fafc"
                tickFormatter={() => ""}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
