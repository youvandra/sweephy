"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { Shield, Save, AlertCircle, Clock, Percent, DollarSign, Wallet, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { 
  Client, 
  AccountId, 
  AccountAllowanceApproveTransaction, 
  Hbar,
  HbarUnit,
  TransactionId
} from "@hashgraph/sdk";
import { useAppKitProvider } from "@reown/appkit/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AllowanceStatus = "idle" | "loading" | "success" | "error";

// ─── Sub-components ───────────────────────────────────────────────────────────

const RuleInput = ({ label, value, onChange, icon: Icon, suffix, description, placeholder }: any) => (
  <div className="space-y-3 bg-white p-5 rounded-2xl border border-secondary/10 hover:border-primary/50 transition-colors group">
    <div className="flex justify-between items-start">
      <label className="text-sm font-bold text-secondary flex items-center gap-2">
        <div className="p-2 bg-secondary-light rounded-lg text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <Icon className="w-4 h-4" />
        </div>
        {label}
      </label>
      {suffix && <span className="text-xs font-bold text-alt-1 bg-secondary-light px-2 py-1 rounded-md">{suffix}</span>}
    </div>
    <div className="relative">
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-4 py-3 bg-secondary-light/50 border border-transparent rounded-xl font-bold text-secondary focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-alt-2"
        placeholder={placeholder}
      />
    </div>
    {description && <p className="text-xs text-alt-1 leading-relaxed">{description}</p>}
  </div>
);

/** Skeleton block untuk allowance card */
const AllowanceCardSkeleton = () => (
  <div className="p-4 rounded-2xl border border-white/10 bg-white/5 animate-pulse space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full bg-white/20" />
      <div className="h-4 w-24 bg-white/20 rounded-md" />
    </div>
    <div className="h-3 w-32 bg-white/10 rounded-md" />
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const { address, isConnected } = useAppKitAccount();
  const { switchNetwork } = useAppKitNetwork();
  // @ts-ignore
  const { walletProvider: hederaProvider } = useAppKitProvider("hedera");
  // @ts-ignore
  const { walletProvider: evmProvider } = useAppKitProvider("eip155");

  const [rules, setRules] = useState({
    swap_amount: 50,
    max_per_swap: 100,
    daily_limit: 1000,
    cooldown_seconds: 60,
    slippage_tolerance: 0.5,
    allowance_granted: false,
    hbar_allowance_amount: 0,
  });

  const PLATFORM_SPENDER_ID = process.env.NEXT_PUBLIC_PLATFORM_SPENDER_ID || "0.0.10304901";

  const [loading, setLoading] = useState(false);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [allowanceInput, setAllowanceInput] = useState(1000);
  const [isFetching, setIsFetching] = useState(true);

  /**
   * allowanceStatus:
   *   "idle"    → belum pernah fetch
   *   "loading" → sedang fetch (tampilkan skeleton di allowance card)
   *   "success" → fetch berhasil, data bisa dipercaya
   *   "error"   → fetch gagal, tetap skeleton sampai retry berhasil
   */
  const [allowanceStatus, setAllowanceStatus] = useState<AllowanceStatus>("idle");

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      if (!address) { setIsFetching(false); return; }
      setIsFetching(true);
      await Promise.all([fetchRules(), checkRealtimeAllowance()]);
      setIsFetching(false);
    }
    loadData();
  }, [address]);

  // ─── Allowance fetch ───────────────────────────────────────────────────────

  /**
   * Fetch allowance dari Mirror Node.
   * - Set status "loading" dulu → skeleton tampil
   * - Kalau berhasil → "success", simpan data
   * - Kalau error / response tidak valid → "error", tetap skeleton
   * - Kalau memang benar-benar 0 / spender tidak ada → "success" dengan nilai 0
   *   (ini valid, bukan error — card tampil "Not Configured")
   */
  async function checkRealtimeAllowance() {
    if (!address) return;

    setAllowanceStatus("loading");

    try {
      // Resolve account ID dari EVM address jika perlu
      let accountId = address;
      if (address.startsWith("0x")) {
        try {
          const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`);
          const data = await res.json();
          if (data?.account) accountId = data.account;
        } catch {
          try { accountId = AccountId.fromEvmAddress(0, 0, address).toString(); } catch {}
        }
      }

      const res = await fetch(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/allowances/crypto`
      );

      // Non-2xx response → error, jangan update data
      if (!res.ok) {
        console.error("Mirror Node non-OK response:", res.status);
        setAllowanceStatus("error");
        return;
      }

      const data = await res.json();

      // Mirror Node returned an error object → tetap skeleton
      if (data?._status?.messages) {
        console.error("Mirror Node error:", data._status.messages);
        setAllowanceStatus("error");
        return;
      }

      // Respons valid — proses allowance
      if (data?.allowances) {
        const platformAllowance = data.allowances.find(
          (a: any) => a.spender === PLATFORM_SPENDER_ID
        );

        if (platformAllowance) {
          const rawAmount = platformAllowance.amount ?? platformAllowance.amount_granted ?? 0;
          const remainingHbar = Number(rawAmount) / 100_000_000;
          setRules(prev => ({
            ...prev,
            allowance_granted: remainingHbar > 0,
            hbar_allowance_amount: remainingHbar,
          }));
        } else {
          // Spender tidak ada → valid, berarti belum di-grant
          setRules(prev => ({ ...prev, allowance_granted: false, hbar_allowance_amount: 0 }));
        }
      } else {
        // allowances array kosong / undefined → valid, nilai 0
        setRules(prev => ({ ...prev, allowance_granted: false, hbar_allowance_amount: 0 }));
      }

      setAllowanceStatus("success");
    } catch (error) {
      console.error("Failed to fetch realtime allowance:", error);
      setAllowanceStatus("error");
      // Tidak update rules.allowance_granted → data lama tetap tersimpan,
      // tapi UI tetap menampilkan skeleton sampai fetch ulang berhasil.
    }
  }

  // ─── Rules fetch ───────────────────────────────────────────────────────────

  async function fetchRules() {
    if (!address) return;
    const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address).limit(1).maybeSingle();
    if (!profile?.id) return;
    const { data: rulesData } = await supabase.from("rules").select("*").eq("user_id", profile.id).single();
    if (rulesData) setRules(rulesData);
  }

  // ─── Grant allowance ───────────────────────────────────────────────────────

  async function handleGrantAllowance() {
    if (!address) { alert("Please connect your wallet first."); return; }

    setAllowanceLoading(true);
    try {
      let provider = hederaProvider as any;

      if (!provider && evmProvider) {
        try {
          await switchNetwork({ chainNamespace: "hedera", chainId: "hedera:mainnet" } as any);
          provider = evmProvider;
        } catch (switchErr) {
          console.warn("Network switch failed:", switchErr);
          provider = evmProvider;
        }
      }

      if (!provider) throw new Error("Wallet provider not initialized.");

      const client = Client.forMainnet();
      const nodeIp = process.env.NEXT_PUBLIC_HEDERA_NODE_IP || "35.237.200.180:50211";
      const nodeAccount = process.env.NEXT_PUBLIC_HEDERA_NODE_ACCOUNT_ID || "0.0.3";
      const networkConfig: { [key: string]: string | AccountId } = {};
      networkConfig[nodeIp] = AccountId.fromString(nodeAccount);
      client.setNetwork(networkConfig);

      const spenderId = AccountId.fromString(PLATFORM_SPENDER_ID);
      const ownerId = AccountId.fromString(address);

      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveHbarAllowance(ownerId, spenderId, Hbar.from(allowanceInput, HbarUnit.Hbar))
        .setTransactionId(TransactionId.generate(ownerId))
        .freezeWith(client);

      const txBase64 = Buffer.from(allowanceTx.toBytes()).toString("base64");
      const params = { signerAccountId: `hedera:mainnet:${address}`, transactionList: txBase64 };

      let result;
      try {
        result = await provider.request({ method: "hedera_signAndExecuteTransaction", params: [params] });
      } catch {
        try {
          result = await provider.request({ method: "hedera_signAndExecuteTransaction", params });
        } catch {
          try {
            result = await provider.request({ method: "hedera_signTransaction", params: [params] });
          } catch (e3: any) {
            throw new Error("Wallet rejected the transaction. " + e3.message);
          }
        }
      }

      setMessage("Native HBAR Allowance Granted!");

      const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address).limit(1).maybeSingle();
      if (profile) {
        await supabase.from("rules").upsert({
          user_id: profile.id,
          allowance_granted: true,
          last_allowance_update: new Date().toISOString(),
        });

        // Polling Mirror Node sampai berhasil (max 5x, interval 3 detik)
        // Pakai recursive async agar tidak kena stale closure
        const pollAllowance = async (attempt = 1) => {
          await checkRealtimeAllowance();
          // checkRealtimeAllowance set state sendiri — cek langsung dari return value
          // caranya: baca Mirror Node lagi via flag local
        };
        let attempt = 0;
        const poll = async (): Promise<void> => {
          attempt++;
          const res = await fetch(
            `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}/allowances/crypto`
          ).then(r => r.json()).catch(() => null);
          if (res?.allowances) {
            await checkRealtimeAllowance();
          } else if (attempt < 5) {
            await new Promise(r => setTimeout(r, 3000));
            await poll();
          }
        };
        setTimeout(poll, 3000);
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to grant allowance: " + err.message);
    } finally {
      setAllowanceLoading(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!address) return;
    setLoading(true);

    let { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address).limit(1).maybeSingle();
    let userId = profile?.id;

    if (!userId) {
      const { data: newProfile } = await supabase.from("profiles").insert({ wallet_address: address.toLowerCase() }).select().single();
      userId = newProfile?.id;
    }

    if (userId) {
      await supabase.from("rules").upsert({ user_id: userId, ...rules, updated_at: new Date().toISOString() });
      setMessage("Settings saved successfully!");
    }

    setLoading(false);
    setTimeout(() => setMessage(""), 3000);
  }

  // ─── Skeleton Page ────────────────────────────────────────────────────────

  const RulesSkeleton = () => (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-12 w-48 bg-gray-200 rounded-xl" />
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 bg-gray-200 rounded-xl" />
              <div className="space-y-2">
                <div className="h-6 w-40 bg-gray-200 rounded-lg" />
                <div className="h-4 w-32 bg-gray-100 rounded-lg" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`h-40 bg-gray-50 rounded-2xl border border-gray-100 ${i === 5 ? "sm:col-span-2" : ""}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div className="bg-gray-100 h-[500px] rounded-[32px]" />
          <div className="h-32 bg-white rounded-2xl border border-gray-100" />
        </div>
      </div>
    </div>
  );

  if (isFetching) return <RulesSkeleton />;

  // ─── Render ───────────────────────────────────────────────────────────────

  /** Apakah allowance card harus tampil sebagai skeleton? */
  const isAllowancePending = allowanceStatus === "idle" || allowanceStatus === "loading" || allowanceStatus === "error";

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Rules & Limits</h1>
          <p className="text-alt-1 mt-1">Configure your automated trading parameters and security thresholds.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-secondary text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 hover:shadow-lg hover:shadow-secondary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Saving..." : (<><Save className="w-4 h-4" />Save Configuration</>)}
        </button>
      </div>

      {message && (
        <div className="bg-primary/10 border border-primary/20 text-secondary px-6 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <p className="font-medium">{message}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Trading Parameters */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-8 rounded-[32px] border border-secondary/5 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary">Trading Parameters</h3>
                <p className="text-sm text-alt-1">Control how your device executes swaps</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <RuleInput label="Amount per Click" value={rules.swap_amount} onChange={(v: number) => setRules({ ...rules, swap_amount: v })} icon={DollarSign} suffix="HBAR" description="The exact amount of HBAR to swap when you press the physical button." placeholder="50" />
              <RuleInput label="Max per Swap" value={rules.max_per_swap} onChange={(v: number) => setRules({ ...rules, max_per_swap: v })} icon={Shield} suffix="HBAR" description="Hard limit for a single transaction to prevent accidental large swaps." placeholder="100" />
              <RuleInput label="Daily Limit" value={rules.daily_limit} onChange={(v: number) => setRules({ ...rules, daily_limit: v })} icon={Wallet} suffix="HBAR" description="Maximum total HBAR volume allowed within a 24-hour period." placeholder="1000" />
              <RuleInput label="Cooldown" value={rules.cooldown_seconds} onChange={(v: number) => setRules({ ...rules, cooldown_seconds: v })} icon={Clock} suffix="SECONDS" description="Minimum time interval required between two consecutive swaps." placeholder="60" />
              <div className="sm:col-span-2">
                <RuleInput label="Slippage Tolerance" value={rules.slippage_tolerance} onChange={(v: number) => setRules({ ...rules, slippage_tolerance: v })} icon={Percent} suffix="%" description="Your transaction will revert if the price changes unfavorably by more than this percentage." placeholder="0.5" />
              </div>
            </div>
          </section>
        </div>

        {/* Allowance Section */}
        <div className="space-y-8">
          <section className="bg-secondary text-white p-8 rounded-[32px] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-white/10 rounded-xl text-primary backdrop-blur-sm">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Allowance</h3>
                  <p className="text-sm text-gray-400">Required for automation</p>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-8">
                You must grant an allowance to the Sweephy Platform Key. This enables our secure AWS KMS to sign swap transactions on your behalf without exposing your private key.
              </p>

              <div className="space-y-4">
                {/* 
                  Status card:
                  - Skeleton  → saat idle / loading / error (belum ada data yang bisa dipercaya)
                  - Real data → hanya saat "success"
                */}
                {isAllowancePending ? (
                  <AllowanceCardSkeleton />
                ) : (
                  <div className={`p-4 rounded-2xl border transition-all ${
                    rules.allowance_granted
                      ? "bg-primary/10 border-primary/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}>
                    <div className="flex items-center gap-3">
                      {rules.allowance_granted ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                      <div>
                        <p className={`text-sm font-bold ${rules.allowance_granted ? "text-primary" : "text-red-400"}`}>
                          {rules.allowance_granted ? "Active" : "Not Configured"}
                        </p>
                        {rules.allowance_granted && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            Remaining:&nbsp;
                            {allowanceStatus === "success"
                              ? `${rules.hbar_allowance_amount ?? 0} HBAR`
                              : <span className="inline-block h-3 w-16 bg-white/20 rounded animate-pulse" />
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Update Allowance</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={allowanceInput}
                      onChange={(e) => setAllowanceInput(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white focus:bg-white/10 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                      placeholder="Amount"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">HBAR</span>
                  </div>
                </div>

                <button
                  onClick={handleGrantAllowance}
                  disabled={allowanceLoading}
                  className="w-full bg-primary text-secondary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4 cursor-pointer"
                >
                  {allowanceLoading ? "Processing..." : (
                    <>
                      {rules.allowance_granted ? "Update Limit" : "Grant Allowance"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          <div className="p-6 rounded-2xl bg-white border border-secondary/5 shadow-sm">
            <h4 className="font-bold text-secondary mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-alt-1" />
              Did you know?
            </h4>
            <p className="text-sm text-alt-1 leading-relaxed">
              Allowances are the safest way to delegate signing rights. You can revoke or change this limit at any time directly from this dashboard or any Hedera wallet explorer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}