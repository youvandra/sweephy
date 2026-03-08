"use client";

import { useState, useEffect } from "react";
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
import { useToast } from "@/components/ui/Toast";
import { useProfile } from "@/hooks/useProfile";
import { fetchRules, saveRules, checkRealtimeAllowance } from "@/lib/api/rules";
import { supabase } from "@/lib/supabase";

type AllowanceStatus = "idle" | "loading" | "success" | "error";

const RuleInput = ({ label, value, onChange, icon: Icon, suffix, description, placeholder, presets }: any) => (
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
    <div className="space-y-3">
      <div className="relative">
        <input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-secondary-light/50 border border-transparent rounded-xl font-bold text-secondary focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-alt-2"
          placeholder={placeholder}
        />
      </div>
      {presets && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset: number) => (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                Number(value) === preset 
                  ? "bg-primary text-secondary shadow-md shadow-primary/20" 
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {preset}{suffix === '%' ? '%' : suffix === 'SECONDS' ? 's' : ''}
            </button>
          ))}
        </div>
      )}
    </div>
    {description && <p className="text-xs text-alt-1 leading-relaxed">{description}</p>}
  </div>
);

const AllowanceCardSkeleton = () => (
  <div className="p-4 rounded-2xl border border-white/10 bg-white/5 animate-pulse space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full bg-white/20" />
      <div className="h-4 w-24 bg-white/20 rounded-md" />
    </div>
    <div className="h-3 w-32 bg-white/10 rounded-md" />
  </div>
);

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function RulesPage() {
  const { address } = useAppKitAccount();
  const { userId, loading: profileLoading } = useProfile();
  const { switchNetwork } = useAppKitNetwork();
  // @ts-ignore
  const { walletProvider: hederaProvider } = useAppKitProvider("hedera");
  // @ts-ignore
  const { walletProvider: evmProvider } = useAppKitProvider("eip155");
  const toast = useToast();

  const [initialRules, setInitialRules] = useState<{
    swap_amount: number | string;
    max_per_swap: number | string;
    daily_limit: number | string;
    cooldown_seconds: number | string;
    slippage_tolerance: number | string;
  } | null>(null);

  const [rules, setRules] = useState<{
    swap_amount: number | string;
    max_per_swap: number | string;
    daily_limit: number | string;
    cooldown_seconds: number | string;
    slippage_tolerance: number | string;
    allowance_granted: boolean;
    hbar_allowance_amount: number;
  }>({
    swap_amount: "",
    max_per_swap: "",
    daily_limit: "",
    cooldown_seconds: "",
    slippage_tolerance: "",
    allowance_granted: false,
    hbar_allowance_amount: 0,
  });

  const PLATFORM_SPENDER_ID = process.env.NEXT_PUBLIC_SWEEPHY_CONTRACT_ID || "0.0.10354696";

  // UI loading states
  const [loading, setLoading] = useState(false);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [allowanceInput, setAllowanceInput] = useState<number | string>("");
  const [isFetching, setIsFetching] = useState(true);
  const [showAllowanceInput, setShowAllowanceInput] = useState(false);

  const [allowanceStatus, setAllowanceStatus] = useState<AllowanceStatus>("idle");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // ─── Data Initialization ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      if (!userId || !address) { 
        if (!profileLoading) setIsFetching(false); 
        return; 
      }
      setIsFetching(true);
      
      const [rulesData, allowanceResult] = await Promise.all([
        fetchRules(userId),
        checkRealtimeAllowance(address, PLATFORM_SPENDER_ID)
      ]);

      if (rulesData) {
        const loadedRules = {
          swap_amount: rulesData.swap_amount ?? "",
          max_per_swap: rulesData.max_per_swap ?? "",
          daily_limit: rulesData.daily_limit ?? "",
          cooldown_seconds: rulesData.cooldown_seconds ?? "",
          slippage_tolerance: rulesData.slippage_tolerance ?? "",
          allowance_granted: rulesData.allowance_granted || false,
          hbar_allowance_amount: rulesData.hbar_allowance_amount || 0,
        };
        
        // Merge allowance result if success
        if (allowanceResult.status === "success") {
            loadedRules.allowance_granted = allowanceResult.allowance_granted || false;
            loadedRules.hbar_allowance_amount = allowanceResult.hbar_allowance_amount || 0;
            setAllowanceStatus("success");
        } else {
            setAllowanceStatus("error");
        }

        setRules(loadedRules);
        setInitialRules({
          swap_amount: loadedRules.swap_amount,
          max_per_swap: loadedRules.max_per_swap,
          daily_limit: loadedRules.daily_limit,
          cooldown_seconds: loadedRules.cooldown_seconds,
          slippage_tolerance: loadedRules.slippage_tolerance,
        });
      }
      
      setIsFetching(false);
    }
    loadData();
  }, [userId, address, profileLoading]);


  // ─── Transaction Handlers ───────────────────────────────────────────────────

  /**
   * Executes a Hedera transaction to approve HBAR allowance for the platform spender.
   * Supports both native Hedera wallets and EVM wallets via network switching.
   */
  async function handleGrantAllowance() {
    if (!address) { toast.error("Please connect your wallet first."); return; }

    const amount = Number(allowanceInput);
    if (!amount || amount <= 0) {
      toast.warning("Please enter a valid allowance amount.");
      return;
    }

    setAllowanceLoading(true);
    try {
      let provider = hederaProvider as any;

      // Fallback to EVM provider with network switch attempt
      if (!provider && evmProvider) {
        try {
          await switchNetwork({ chainNamespace: "hedera", chainId: "hedera:mainnet" } as any);
          provider = evmProvider;
        } catch (switchErr) {
          provider = evmProvider;
        }
      }

      if (!provider) throw new Error("Wallet provider not initialized.");

      // Configure Hedera Client
      const client = Client.forMainnet();
      
      // Use custom node if configured in env
      const nodeIp = process.env.NEXT_PUBLIC_HEDERA_NODE_IP;
      const nodeAccount = process.env.NEXT_PUBLIC_HEDERA_NODE_ACCOUNT_ID;
      
      if (nodeIp && nodeAccount) {
        const networkConfig: { [key: string]: string | AccountId } = {};
        networkConfig[nodeIp] = AccountId.fromString(nodeAccount);
        client.setNetwork(networkConfig);
      }

      const spenderId = AccountId.fromString(PLATFORM_SPENDER_ID);
      const ownerId = AccountId.fromString(address);

      // Construct and freeze transaction
      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveHbarAllowance(ownerId, spenderId, Hbar.from(amount, HbarUnit.Hbar))
        .setTransactionId(TransactionId.generate(ownerId))
        .freezeWith(client);

      const txBase64 = Buffer.from(allowanceTx.toBytes()).toString("base64");
      const params = { signerAccountId: `hedera:mainnet:${address}`, transactionList: txBase64 };

      // Execute transaction via wallet provider
      let result;
      try {
        // Try the standard format first (params array)
        result = await provider.request({ method: "hedera_signAndExecuteTransaction", params: [params] });
      } catch (e1) {
        try {
          // Fallback: Some wallets might expect the object directly if they deviate from spec
          result = await provider.request({ method: "hedera_signAndExecuteTransaction", params });
        } catch (e2) {
          try {
             // Fallback to sign only if execution fails (though logic below assumes executed)
             // Or try with just the transactionList string if param structure is different
             const simpleParams = { transactionList: txBase64 };
             result = await provider.request({ method: "hedera_signAndExecuteTransaction", params: [simpleParams] });
          } catch (e3: any) {
             console.error("Allowance Grant Error:", e3);
             throw new Error("Wallet rejected the transaction or method not supported.");
          }
        }
      }

      toast.success("Native HBAR Allowance Granted!");

      // Update database and poll for confirmation
      if (userId) {
        await supabase.from("rules").upsert({
          user_id: userId,
          allowance_granted: true,
          last_allowance_update: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        const pollAllowance = async (attempt = 1) => {
          const res = await checkRealtimeAllowance(address, PLATFORM_SPENDER_ID);
          if (res.status === "success" && res.allowance_granted) {
             setRules(prev => ({
                 ...prev,
                 allowance_granted: true,
                 hbar_allowance_amount: res.hbar_allowance_amount || 0
             }));
             setAllowanceStatus("success");
          } else if (attempt < 5) {
             setTimeout(() => pollAllowance(attempt + 1), 3000);
          }
        };
        setTimeout(() => pollAllowance(1), 3000);
      }
    } catch (err: any) {
      toast.error("Failed to grant allowance: " + err.message);
    } finally {
      setAllowanceLoading(false);
    }
  }

  /**
   * Revokes the HBAR allowance by setting it to 0.
   */
  async function handleRevokeAllowance() {
    if (!address) { toast.error("Please connect your wallet first."); return; }
    
    setRevokeLoading(true);
    try {
      let provider = hederaProvider as any;

      if (!provider && evmProvider) {
        try {
          await switchNetwork({ chainNamespace: "hedera", chainId: "hedera:mainnet" } as any);
          provider = evmProvider;
        } catch {
          provider = evmProvider;
        }
      }

      if (!provider) throw new Error("Wallet provider not initialized.");

      const client = Client.forMainnet();
      const nodeIp = process.env.NEXT_PUBLIC_HEDERA_NODE_IP;
      const nodeAccount = process.env.NEXT_PUBLIC_HEDERA_NODE_ACCOUNT_ID;
      
      if (nodeIp && nodeAccount) {
        const networkConfig: { [key: string]: string | AccountId } = {};
        networkConfig[nodeIp] = AccountId.fromString(nodeAccount);
        client.setNetwork(networkConfig);
      }

      const spenderId = AccountId.fromString(PLATFORM_SPENDER_ID);
      const ownerId = AccountId.fromString(address);

      // Set allowance to 0 to revoke
      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveHbarAllowance(ownerId, spenderId, Hbar.from(0, HbarUnit.Hbar))
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

      toast.success("Allowance Revoked Successfully!");

      if (userId) {
        await supabase.from("rules").upsert({
          user_id: userId,
          allowance_granted: false,
          last_allowance_update: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        setRules(prev => ({
          ...prev,
          allowance_granted: false,
          hbar_allowance_amount: 0
        }));
        setAllowanceStatus("idle");
        setShowAllowanceInput(false);
        setShowRevokeModal(false);
      }
    } catch (err: any) {
      toast.error("Failed to revoke allowance: " + err.message);
    } finally {
      setRevokeLoading(false);
    }
  }

  /**
   * Persists updated trading rules to Supabase.
   */
  async function handleSave() {
    if (!userId) return;
    setLoading(true);

    const { error } = await saveRules(userId, rules);
    
    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      setInitialRules({
        swap_amount: rules.swap_amount,
        max_per_swap: rules.max_per_swap,
        daily_limit: rules.daily_limit,
        cooldown_seconds: rules.cooldown_seconds,
        slippage_tolerance: rules.slippage_tolerance,
      });
      toast.success("Settings saved successfully!");
    }

    setLoading(false);
  }

  // Check if rules have changed
  const hasChanges = initialRules ? (
    rules.swap_amount !== initialRules.swap_amount ||
    rules.max_per_swap !== initialRules.max_per_swap ||
    rules.daily_limit !== initialRules.daily_limit ||
    rules.cooldown_seconds !== initialRules.cooldown_seconds ||
    rules.slippage_tolerance !== initialRules.slippage_tolerance
  ) : false;

  // ─── Component Render ───────────────────────────────────────────────────────

  const RulesSkeleton = () => (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-48 bg-gray-200 rounded-lg" />
          <div className="h-5 w-80 bg-gray-100 rounded-lg" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column Skeleton (Allowance) */}
        <div className="space-y-8">
          {/* Allowance Card Skeleton */}
          <div className="bg-secondary p-8 rounded-[32px] h-[420px] relative overflow-hidden border border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-xl" />
              <div className="space-y-2">
                <div className="h-6 w-32 bg-white/10 rounded-lg" />
                <div className="h-4 w-40 bg-white/5 rounded-lg" />
              </div>
            </div>
            <div className="space-y-3 mb-8">
              <div className="h-4 w-full bg-white/5 rounded-lg" />
              <div className="h-4 w-3/4 bg-white/5 rounded-lg" />
            </div>
            <div className="space-y-4">
              <div className="h-16 w-full bg-white/5 rounded-2xl border border-white/10" />
              <div className="h-14 w-full bg-primary/20 rounded-xl" />
            </div>
          </div>

          {/* Info Card Skeleton */}
          <div className="p-6 rounded-2xl bg-white border border-secondary/5 space-y-3">
            <div className="h-5 w-32 bg-gray-200 rounded-lg" />
            <div className="h-4 w-full bg-gray-100 rounded-lg" />
            <div className="h-4 w-2/3 bg-gray-100 rounded-lg" />
          </div>
        </div>

        {/* Right Column Skeleton (Swap Parameters) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[32px] border border-secondary/5 shadow-sm">
            {/* Card Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-primary/10 rounded-xl" />
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 rounded-lg" />
                <div className="h-4 w-64 bg-gray-100 rounded-lg" />
              </div>
            </div>

            {/* Input Grid */}
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`bg-white p-5 rounded-2xl border border-gray-100 space-y-3 ${i === 5 ? "sm:col-span-2" : ""}`}>
                  <div className="flex justify-between items-center">
                    <div className="h-5 w-32 bg-gray-100 rounded-md" />
                    <div className="h-5 w-12 bg-gray-100 rounded-md" />
                  </div>
                  <div className="h-12 w-full bg-gray-50 rounded-xl" />
                  <div className="flex gap-2">
                    <div className="h-6 w-12 bg-gray-100 rounded-md" />
                    <div className="h-6 w-12 bg-gray-100 rounded-md" />
                    <div className="h-6 w-12 bg-gray-100 rounded-md" />
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="h-14 w-full bg-secondary/10 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );

  if (isFetching) return <RulesSkeleton />;

  const isAllowancePending = allowanceStatus === "idle" || allowanceStatus === "loading" || allowanceStatus === "error";

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Rules & Limits</h1>
          <p className="text-alt-1 mt-1">Configure your automated trading parameters and security thresholds.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Allowance (Formerly Right) */}
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

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  (showAllowanceInput || !rules.allowance_granted) ? "max-h-24 opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"
                }`}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Set Allowance Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={allowanceInput}
                        onChange={(e) => setAllowanceInput(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-white focus:bg-white/10 focus:border-primary outline-none transition-all placeholder:text-gray-600"
                        placeholder="Amount"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">HBAR</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (rules.allowance_granted && !showAllowanceInput) {
                      setShowAllowanceInput(true);
                    } else {
                      handleGrantAllowance();
                    }
                  }}
                  disabled={allowanceLoading}
                  className="w-full bg-primary text-secondary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4 cursor-pointer"
                >
                  {allowanceLoading ? "Processing..." : (
                    <>
                      {rules.allowance_granted && !showAllowanceInput ? "Update Limit" : (rules.allowance_granted ? "Update" : "Grant Allowance")}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {rules.allowance_granted && (
                  <button
                    onClick={() => setShowRevokeModal(true)}
                    disabled={revokeLoading || allowanceLoading}
                    className="w-full bg-red-500/10 text-red-400 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer border border-red-500/20"
                  >
                    Revoke
                  </button>
                )}
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

        {/* Right Column - Swap Parameters (Formerly Left) */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white p-8 rounded-[32px] border border-secondary/5 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary">Swap Parameters</h3>
                <p className="text-sm text-alt-1">Control how your device executes swaps</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <RuleInput 
                label="Amount per Click" 
                value={rules.swap_amount} 
                onChange={(v: number) => setRules({ ...rules, swap_amount: v })} 
                icon={DollarSign} 
                suffix="HBAR" 
                description="The exact amount of HBAR to swap when you press the physical button." 
                placeholder="50" 
                presets={[10, 50, 100, 250]}
              />
              <RuleInput 
                label="Max per Swap" 
                value={rules.max_per_swap} 
                onChange={(v: number) => setRules({ ...rules, max_per_swap: v })} 
                icon={Shield} 
                suffix="HBAR" 
                description="Hard limit for a single transaction to prevent accidental large swaps." 
                placeholder="100" 
                presets={[50, 100, 500, 1000]}
              />
              <RuleInput 
                label="Daily Limit" 
                value={rules.daily_limit} 
                onChange={(v: number) => setRules({ ...rules, daily_limit: v })} 
                icon={Wallet} 
                suffix="HBAR" 
                description="Maximum total HBAR volume allowed within a 24-hour period." 
                placeholder="1000" 
                presets={[500, 1000, 5000, 10000]}
              />
              <RuleInput 
                label="Cooldown" 
                value={rules.cooldown_seconds} 
                onChange={(v: number) => setRules({ ...rules, cooldown_seconds: v })} 
                icon={Clock} 
                suffix="SECONDS" 
                description="Minimum time interval required between two consecutive swaps." 
                placeholder="60" 
                presets={[10, 20, 60, 300]}
              />
              <div className="sm:col-span-2">
                <RuleInput 
                  label="Slippage Tolerance" 
                  value={rules.slippage_tolerance} 
                  onChange={(v: number) => setRules({ ...rules, slippage_tolerance: v })} 
                  icon={Percent} 
                  suffix="%" 
                  description="Your transaction will revert if the price changes unfavorably by more than this percentage." 
                  placeholder="0.5" 
                  presets={[0.1, 0.5, 1, 3]}
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={loading || !hasChanges}
              className="w-full bg-secondary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 hover:shadow-lg hover:shadow-secondary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Saving..." : (<><Save className="w-4 h-4" />Save Configuration</>)}
            </button>
          </section>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-500 mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-secondary mb-2">Revoke Allowance?</h3>
              <p className="text-gray-500 text-sm">
                This will disable automated swaps. You will need to grant allowance again to resume trading.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRevokeModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleRevokeAllowance}
                disabled={revokeLoading}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {revokeLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Revoke"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
