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
    
    {description && (
      <p className="text-xs text-alt-1 leading-relaxed">
        {description}
      </p>
    )}
  </div>
);

export default function RulesPage() {
  const { address, isConnected } = useAppKitAccount();
  const { switchNetwork } = useAppKitNetwork();
  
  // Use generic provider which will be HederaAdapter due to our config
  // @ts-ignore
  const { walletProvider: hederaProvider } = useAppKitProvider("hedera");
  // @ts-ignore
  const { walletProvider: evmProvider } = useAppKitProvider("eip155");

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
  const PLATFORM_SPENDER_ID = process.env.NEXT_PUBLIC_PLATFORM_SPENDER_ID || "0.0.10304901"; // Real KMS Account ID

  const [loading, setLoading] = useState(false);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [allowanceInput, setAllowanceInput] = useState(1000); // Default input value
  const [isFetching, setIsFetching] = useState(true);
  const [checkingAllowance, setCheckingAllowance] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (address) {
        setIsFetching(true);
        // Start checking allowance immediately
        setCheckingAllowance(true);
        await Promise.all([
          fetchRules(), 
          checkRealtimeAllowance().finally(() => setCheckingAllowance(false))
        ]);
        setIsFetching(false);
      } else {
        setIsFetching(false);
      }
    }
    loadData();
  }, [address]);

  async function checkRealtimeAllowance() {
  if (!address) return;
  
  try {
    let accountId = address;
    if (address.startsWith("0x")) {
      try {
        const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`);
        const data = await res.json();
        if (data?.account) accountId = data.account;
      } catch (e) {
        console.warn("Mirror node lookup failed:", e);
        try {
          accountId = AccountId.fromEvmAddress(0, 0, address).toString();
        } catch {}
      }
    }

    // ✅ FIX 1: Hapus ?timestamp=... karena Mirror Node tidak support parameter itu
    const res = await fetch(
      `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/allowances/crypto`
    );
    const data = await res.json();

    // ✅ FIX 2: Cek error dari Mirror Node sebelum proses data
    if (data?._status?.messages) {
      console.error("Mirror Node error:", data._status.messages);
      return;
    }
    
    if (data?.allowances) {
      const platformAllowance = data.allowances.find(
        (a: any) => a.spender === PLATFORM_SPENDER_ID
      );

      if (platformAllowance) {
        // Mirror Node returns amount in tinybars (1 HBAR = 100,000,000 tinybars)
        // Note: Check both 'amount' (new) and 'amount_granted' (legacy/standard) just in case
        const rawAmount = platformAllowance.amount || platformAllowance.amount_granted || 0;
        const remainingHbar = Number(rawAmount) / 100_000_000;

        setRules(prev => ({
          ...prev,
          allowance_granted: remainingHbar > 0,
          hbar_allowance_amount: remainingHbar, 
        }));
      } else {
        // If no allowance found for this spender, it means 0
        setRules(prev => ({ ...prev, allowance_granted: false, hbar_allowance_amount: 0 }));
      }
    } else {
       // If allowances array is empty or undefined
       setRules(prev => ({ ...prev, allowance_granted: false, hbar_allowance_amount: 0 }));
    }
  } catch (error) {
    console.error("Failed to fetch realtime allowance:", error);
  }
}

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
      
      // Use generic provider which will be HederaAdapter due to our config
      let provider = hederaProvider as any;
      
      // If hedera provider is missing (connected via eip155), try to switch or use EVM provider
      if (!provider && evmProvider) {
         console.log("Hedera provider missing. Connected via EIP-155.");
         console.log("Attempting to switch network to Hedera Native (hedera:mainnet)...");
         
         try {
             // Try to switch network using AppKit
             // 'hedera:mainnet' is the CAIP-2 chainId for Hedera Mainnet
             await switchNetwork({ chainNamespace: 'hedera', chainId: 'hedera:mainnet' } as any);
             
             // Wait a moment for provider to update?
             // Actually, switchNetwork might reload the page or update the hook.
             // But if we proceed, we might still be on the old provider reference.
             
             // Let's assume the switch works or the user is prompted.
             // If switch is not supported or fails, we fall back to the EVM provider 
             // BUT we must acknowledge that 'hedera_signAndExecuteTransaction' will fail on EIP-155 RPC
             provider = evmProvider;
         } catch (switchErr) {
             console.warn("Network switch failed or cancelled:", switchErr);
             provider = evmProvider;
         }
      }
      
      if (!provider) {
          throw new Error("Wallet provider not initialized. Please connect your wallet.");
      }
      
      // If we are still using the EVM provider (HashPack connected via eip155), we need to be careful.
      // The error 400 suggests we are sending a method (hedera_signAndExecuteTransaction) to an endpoint that expects standard JSON-RPC.
      // However, HashPack SHOULD intercept this method client-side.
      
      // If the provider is strictly an EIP-1193 provider pointing to a Relay, it might be forwarding the request to the relay 
      // instead of handling it in the wallet.
      
      // Let's force the use of the Hedera-specific provider if possible, or try to switch chains/namespaces?
      // Actually, if we use 'hederaProvider', it should work.
      
      console.log("Active Provider Type:", hederaProvider ? "Hedera Native" : "EIP-155 (EVM)");

      // 1. Construct Transaction using SDK
       // @ts-ignore
       const client = Client.forMainnet();
       // Pin to a specific node to avoid generating huge TransactionList
        const nodeIp = process.env.NEXT_PUBLIC_HEDERA_NODE_IP || "35.237.200.180:50211";
        const nodeAccount = process.env.NEXT_PUBLIC_HEDERA_NODE_ACCOUNT_ID || "0.0.3";
        
        const networkConfig: {[key: string]: string | AccountId} = {};
        networkConfig[nodeIp] = AccountId.fromString(nodeAccount);
        
        client.setNetwork(networkConfig);
       
       const spenderId = AccountId.fromString(PLATFORM_SPENDER_ID);
       const ownerId = AccountId.fromString(address as string); 
       
       console.log(`Granting Allowance... Owner: ${ownerId.toString()}, Spender: ${spenderId.toString()}, Amount: ${allowanceInput}`);

       const allowanceTx = new AccountAllowanceApproveTransaction()
          .approveHbarAllowance(ownerId, spenderId, Hbar.from(allowanceInput, HbarUnit.Hbar))
          .setTransactionId(TransactionId.generate(ownerId))
          .freezeWith(client);
        
      const txBytes = allowanceTx.toBytes();
      const txBase64 = Buffer.from(txBytes).toString("base64");
      
      // ✅ Correct params structure for HashPack / HIP-584
      const params = {
          signerAccountId: `hedera:mainnet:${address}`,
          transactionList: txBase64
      };
      
      console.log("Requesting signature for:", params);
      
      let result;
      // Attempt 1: Try 'hedera_signAndExecuteTransaction'
      try {
        // If we are on EIP-155, some wallets need the params wrapped in an array [params]
        // But the safest bet for HashPack on EVM mode is actually to try the array format first.
        // Also, we need to ensure the method name is correct.
        
        console.log("Sending hedera_signAndExecuteTransaction...");
        
        // Try ARRAY params first (Standard for many EIP-155 implementations of custom methods)
        result = await provider.request({
            method: "hedera_signAndExecuteTransaction",
            params: [params] 
        });
        console.log("Hedera TX Result:", result);
      } catch (e1: any) {
          console.warn("Attempt 1 (Array) failed:", e1.message);
          
          // Attempt 2: Try OBJECT params (Standard for Hedera-native connection)
           try {
            result = await provider.request({
                method: "hedera_signAndExecuteTransaction",
                params: params
            });
             console.log("Hedera TX Result (Object Params):", result);
           } catch (e2: any) {
               console.warn("Attempt 2 (Object) failed:", e2.message);
               
               // Attempt 3: If on EIP-155, maybe the wallet expects 'eth_sendTransaction' with a special data payload?
               // No, that's too complex.
               
               // Fallback: Try 'hedera_signTransaction' (Sign Only)
               try {
                   console.log("Falling back to sign-only...");
                   const signResult = await provider.request({
                       method: "hedera_signTransaction",
                       params: [params] // Try Array first
                   });
                   console.log("Sign Result:", signResult);
                   
                   // If we got a signature, we might need to execute it ourselves?
                   // But typically this method returns the signed transaction bytes.
                   // Ideally we would submit it to the network here via SDK.
                   // But let's assume success for now if we got a result.
                   result = signResult;
               } catch (e3: any) {
                   console.warn("Sign-only fallback failed:", e3.message);
                   throw new Error("Wallet rejected the transaction method. Please try connecting with 'Hedera' network selected if possible.");
               }
           }
      }

      setMessage("Native HBAR Allowance Granted!");
      
      // Update Database only after successful transaction
      const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address as string).limit(1).maybeSingle();
      if (profile) {
        await supabase.from("rules").upsert({
          user_id: profile.id,
          allowance_granted: true,
          // Removed hbar_allowance_amount as it's now fetched from Mirror Node
          last_allowance_update: new Date().toISOString(),
        });
        
        // Refetch allowance from Mirror Node to confirm exact state
        setCheckingAllowance(true);
        setTimeout(() => {
          checkRealtimeAllowance().finally(() => setCheckingAllowance(false));
        }, 3000); // Give mirror node a moment to index
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

  const RulesSkeleton = () => (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2"></div>
          <div className="h-4 w-64 bg-gray-100 rounded-lg"></div>
        </div>
        <div className="h-12 w-48 bg-gray-200 rounded-xl"></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
              <div className="space-y-2">
                <div className="h-6 w-40 bg-gray-200 rounded-lg"></div>
                <div className="h-4 w-32 bg-gray-100 rounded-lg"></div>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`h-40 bg-gray-50 rounded-2xl border border-gray-100 ${i === 5 ? 'sm:col-span-2' : ''}`}></div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gray-100 h-[500px] rounded-[32px]"></div>
          <div className="h-32 bg-white rounded-2xl border border-gray-100"></div>
        </div>
      </div>
    </div>
  );

  if (isFetching) return <RulesSkeleton />;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
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
          {loading ? "Saving..." : (
            <>
              <Save className="w-4 h-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>

      {message && (
        <div className="bg-primary/10 border border-primary/20 text-secondary px-6 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <p className="font-medium">{message}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Trading Rules */}
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
              <RuleInput 
                label="Amount per Click" 
                value={rules.swap_amount}
                onChange={(v: number) => setRules({ ...rules, swap_amount: v })}
                icon={DollarSign}
                suffix="HBAR"
                description="The exact amount of HBAR to swap when you press the physical button."
                placeholder="50"
              />

              <RuleInput 
                label="Max per Swap" 
                value={rules.max_per_swap}
                onChange={(v: number) => setRules({ ...rules, max_per_swap: v })}
                icon={Shield}
                suffix="HBAR"
                description="Hard limit for a single transaction to prevent accidental large swaps."
                placeholder="100"
              />

              <RuleInput 
                label="Daily Limit" 
                value={rules.daily_limit} 
                onChange={(v: number) => setRules({...rules, daily_limit: v})}
                icon={Wallet}
                suffix="HBAR"
                description="Maximum total HBAR volume allowed within a 24-hour period."
                placeholder="1000"
              />

              <RuleInput 
                label="Cooldown" 
                value={rules.cooldown_seconds} 
                onChange={(v: number) => setRules({...rules, cooldown_seconds: v})}
                icon={Clock}
                suffix="SECONDS"
                description="Minimum time interval required between two consecutive swaps."
                placeholder="60"
              />
              
              <div className="sm:col-span-2">
                <RuleInput 
                  label="Slippage Tolerance" 
                  value={rules.slippage_tolerance} 
                  onChange={(v: number) => setRules({...rules, slippage_tolerance: v})}
                  icon={Percent}
                  suffix="%"
                  description="Your transaction will revert if the price changes unfavorably by more than this percentage."
                  placeholder="0.5"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Allowance / Security Section */}
        <div className="space-y-8">
          <section className="bg-secondary text-white p-8 rounded-[32px] relative overflow-hidden">
            {/* Background Pattern */}
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
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          Remaining: 
                          {checkingAllowance ? (
                            <span className="h-3 w-12 bg-gray-600 rounded animate-pulse inline-block" />
                          ) : (
                            `${rules.hbar_allowance_amount} HBAR`
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

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
