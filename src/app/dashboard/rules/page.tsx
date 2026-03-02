"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppKitAccount } from "@reown/appkit/react";
import { Shield, Save, AlertCircle, Clock, Percent, DollarSign, Wallet, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { 
  Client, 
  AccountId, 
  AccountAllowanceApproveTransaction, 
  Hbar,
  TransactionId
} from "@hashgraph/sdk";
import { useAppKitProvider } from "@reown/appkit/react";
// import type { Provider } from "@reown/appkit-adapter-wagmi"; // Removed to fix import error

export default function RulesPage() {
  const { address } = useAppKitAccount();
  // Use generic provider which will be HederaAdapter due to our config
  // @ts-ignore
  const { walletProvider } = useAppKitProvider("hedera");

  const [rules, setRules] = useState({
    swap_amount: 50, // Default per-click amount
    max_per_swap: 100,
    daily_limit: 1000,
    cooldown_seconds: 60,
    slippage_tolerance: 0.5,
    allowance_granted: false,
    hbar_allowance_amount: 0,
  });
  
  // Hardcoded Platform Public Key (In production, fetch from /api/config)
  // This is the public key of the AWS KMS key that signs transactions
  const PLATFORM_SPENDER_ID = "0.0.10304901"; // Real KMS Account ID

  const [loading, setLoading] = useState(false);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchRules();
  }, [address]);

  async function fetchRules() {
    if (!address) return;

    const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address as string).limit(1).maybeSingle();
    let userId = profile?.id;

    if (!userId) return;

    const { data: rulesData } = await supabase.from("rules").select("*").eq("user_id", userId).single();
    if (rulesData) setRules(rulesData);
  }

  async function handleGrantAllowance() {
    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }
    
    setAllowanceLoading(true);
    try {
      console.log("Initiating Allowance Transaction...");
      console.log("Spender (Platform KMS):", PLATFORM_SPENDER_ID);
      
      // Use Hedera provider
      const provider = walletProvider as any;
      
      if (!provider) {
          throw new Error("Wallet provider not initialized. Please connect your wallet.");
      }

      // --- NATIVE HEDERA ALLOWANCE VIA WALLET CONNECT (RAW REQUEST) ---
      // Since we are using HashPack (Native), we should construct a Hedera Transaction
      // and send it via the provider using the appropriate method.
      // If using @reown/appkit with Hedera Adapter, we might have a specific signer.
      // But assuming standard WalletConnect flow for Hedera:
      
      // 1. Construct Transaction using SDK
       // @ts-ignore
       const client = Client.forMainnet();
       // We don't set operator because we will sign externally
       
       const spenderId = AccountId.fromString(PLATFORM_SPENDER_ID);
       
       let ownerIdStr = address as string;
       
       // If address is EVM (0x...), we warn but proceed as some wallets map it.
       if (ownerIdStr.startsWith("0x")) {
           console.warn("Address is EVM format. Native Hedera operations require Account ID (0.0.x).");
           // Attempt to convert or fallback?
           // Ideally, for HashPack native connection, address should be 0.0.x
       }
       
       // Handle Account ID parsing
       const ownerId = AccountId.fromString(ownerIdStr); // Will throw if invalid format
       
       const allowanceTx = new AccountAllowanceApproveTransaction()
         // @ts-ignore
         .approveHbarAllowance(ownerId, spenderId, Hbar.from(1000))
         .setTransactionId(TransactionId.generate(ownerId))
         .freezeWith(client); // Must be frozen to be signed
        
      const txBytes = allowanceTx.toBytes();
      const txBase64 = Buffer.from(txBytes).toString("base64");
      
      // 2. Send Request to Wallet
      
      const params = {
          transaction: {
              type: "bytes",
              bytes: txBase64
          }
      };
      
      const result = await provider.request({
          method: "hedera_signAndExecuteTransaction",
          params: [params]
      });
      
      console.log("Hedera TX Result:", result);
      setMessage("Native HBAR Allowance Granted!");

      // Update Database
      const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address as string).limit(1).maybeSingle();
      if (profile) {
        await supabase.from("rules").upsert({
          user_id: profile.id,
          allowance_granted: true,
          hbar_allowance_amount: 1000, 
          last_allowance_update: new Date().toISOString(),
        });
        
        setRules(prev => ({ ...prev, allowance_granted: true, hbar_allowance_amount: 1000 }));
      }
    } catch (err: any) {
      console.error(err);
      alert("Failed to grant allowance: " + err.message);
    } finally {
      setAllowanceLoading(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  async function handleSave() {
    if (!address) return;
    setLoading(true);

    let { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address as string).limit(1).maybeSingle();
    let userId = profile?.id;

    if (!userId) {
      const { data: newProfile } = await supabase.from("profiles").insert({
        wallet_address: (address as string).toLowerCase(),
      }).select().single();
      userId = newProfile?.id;
    }

    if (userId) {
      await supabase.from("rules").upsert({
        user_id: userId,
        ...rules,
        updated_at: new Date().toISOString(),
      });

      setMessage("Settings saved successfully!");
    }
    setLoading(false);
    setTimeout(() => setMessage(""), 3000);
  }

  const RuleInput = ({ label, value, onChange, icon: Icon, suffix }: any) => (
    <div className="space-y-2">
      <label className="text-sm font-bold text-secondary flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {label}
      </label>
      <div className="relative">
        <input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs uppercase">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-secondary">Rules & Compliance</h1>
        <p className="text-gray-500 text-sm">Configure automated swap enforcement and security policies</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Trading Rules */}
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold flex items-center gap-2 border-b pb-4">
            <Shield className="w-5 h-5 text-primary" />
            Swap Enforcement
          </h3>
          
            {/* Swap Amount Rule */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-secondary flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Amount per Click (HBAR)
              </label>
              <input 
                type="number" 
                value={rules.swap_amount}
                onChange={(e) => setRules({ ...rules, swap_amount: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-lg focus:ring-2 focus:ring-primary outline-none"
              />
              <p className="text-xs text-gray-400">How much HBAR to swap each time you press the device button.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-secondary flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Max per Swap Limit
              </label>
              <input 
                type="number" 
                value={rules.max_per_swap}
                onChange={(e) => setRules({ ...rules, max_per_swap: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          <RuleInput 
            label="Daily Allowance" 
            value={rules.daily_limit} 
            onChange={(v: number) => setRules({...rules, daily_limit: v})}
            icon={Shield}
            suffix="HBAR"
          />
          <RuleInput 
            label="Swap Cooldown" 
            value={rules.cooldown_seconds} 
            onChange={(v: number) => setRules({...rules, cooldown_seconds: v})}
            icon={Clock}
            suffix="SEC"
          />
          <RuleInput 
            label="Slippage Tolerance" 
            value={rules.slippage_tolerance} 
            onChange={(v: number) => setRules({...rules, slippage_tolerance: v})}
            icon={Percent}
            suffix="%"
          />
        </div>

        {/* Security / KMS */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-bold flex items-center gap-2 border-b pb-4">
              <Wallet className="w-5 h-5 text-primary" />
              Automated Signing
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              To enable 1-tap swaps, you must grant an allowance to the Sweephy Platform Key. 
              This allows our secure AWS KMS to sign swap transactions on your behalf within your set limits.
            </p>

            <div className="space-y-4 pt-2">
              <div className={`p-5 rounded-2xl border flex flex-col gap-4 transition-all ${
                rules.allowance_granted ? "bg-green-50 border-green-100" : "bg-primary/5 border-primary/10"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {rules.allowance_granted ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-secondary uppercase tracking-wide">
                        {rules.allowance_granted ? "Allowance Active" : "Setup Required"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {rules.allowance_granted 
                          ? `${rules.hbar_allowance_amount} HBAR allowance granted` 
                          : "Grant allowance to enable device swaps"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleGrantAllowance}
                  disabled={allowanceLoading}
                  className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                    rules.allowance_granted 
                      ? "bg-white text-green-700 border border-green-200 hover:bg-green-50" 
                      : "bg-secondary text-white shadow-lg shadow-secondary/20 hover:bg-secondary/90"
                  }`}
                >
                  {allowanceLoading ? "Processing..." : rules.allowance_granted ? "Update Allowance Limit" : (
                    <>
                      Grant Allowance <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              
              {!rules.allowance_granted && (
                <div className="flex gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Without allowance, your ESP32 device cannot execute trades. The physical button will trigger a "Failed" response until this is set up.
                  </p>
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-secondary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors shadow-lg shadow-secondary/20"
          >
            {loading ? "Saving..." : (
              <>
                <Save className="w-5 h-5" />
                Save All Changes
              </>
            )}
          </button>
          {message && <p className="text-center text-primary font-bold animate-pulse text-sm">{message}</p>}
        </div>
      </div>
    </div>
  );
}
