"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppKitAccount } from "@reown/appkit/react";
import { Shield, Save, AlertCircle, Clock, Percent, DollarSign, Wallet, Key, CheckCircle2, XCircle } from "lucide-react";

export default function RulesPage() {
  const { address } = useAppKitAccount();
  const [rules, setRules] = useState({
    max_per_swap: 100,
    daily_limit: 1000,
    cooldown_seconds: 60,
    slippage_tolerance: 0.5,
    allowance_granted: false,
    hbar_allowance_amount: 0,
  });
  const [kmsArn, setKmsArn] = useState("");
  const [kmsPublicKey, setKmsPublicKey] = useState("");
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

    const { data: keyData } = await supabase.from("wallet_keys").select("kms_arn, kms_public_key").eq("user_id", userId).single();
    if (keyData) {
      setKmsArn(keyData.kms_arn);
      setKmsPublicKey(keyData.kms_public_key || "");
    }
  }

  async function handleGrantAllowance() {
    if (!address) {
      alert("Please connect your wallet first.");
      return;
    }
    if (!kmsPublicKey) {
      alert("Please provide an AWS KMS ARN and save it first to retrieve the Public Key.");
      return;
    }
    setAllowanceLoading(true);
    try {
      // In a real Hedera app, we would use the Hashgraph SDK with WalletConnect
      // For this PoC, we'll simulate the successful allowance grant
      // In production: await wallet.sendTransaction(new CryptoApproveAllowance()...)
      
      console.log("Granting allowance to KMS Public Key:", kmsPublicKey);
      
      const { data: profile } = await supabase.from("profiles").select("id").ilike("wallet_address", address as string).limit(1).maybeSingle();
      if (profile) {
        await supabase.from("rules").upsert({
          user_id: profile.id,
          allowance_granted: true,
          hbar_allowance_amount: 1000, // Grant 1000 HBAR allowance
          last_allowance_update: new Date().toISOString(),
        });
        
        setRules(prev => ({ ...prev, allowance_granted: true, hbar_allowance_amount: 1000 }));
        setMessage("Allowance successfully granted to KMS!");
      }
    } catch (err: any) {
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

      if (kmsArn) {
        // Mocking fetching public key from ARN if not present
        const mockPublicKey = kmsPublicKey || "0x" + Math.random().toString(16).slice(2, 42);
        await supabase.from("wallet_keys").upsert({
          user_id: userId,
          kms_arn: kmsArn,
          kms_public_key: mockPublicKey
        });
        setKmsPublicKey(mockPublicKey);
      }

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
          
          <RuleInput 
            label="Max Per Swap" 
            value={rules.max_per_swap} 
            onChange={(v: number) => setRules({...rules, max_per_swap: v})}
            icon={DollarSign}
            suffix="HBAR"
          />
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
              Custodial Mode (AWS KMS)
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Enable 1-tap swaps without mobile confirmation by linking an AWS KMS ARN. 
              The Edge function will sign transactions securely on your behalf.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-bold text-secondary">AWS KMS ARN</label>
              <input 
                type="text" 
                value={kmsArn}
                onChange={(e) => setKmsArn(e.target.value)}
                placeholder="arn:aws:kms:region:account:key/id"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            {kmsPublicKey && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">KMS Public Key</label>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 font-mono text-[10px] break-all text-gray-500">
                    {kmsPublicKey}
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  rules.allowance_granted ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"
                }`}>
                  <div className="flex items-center gap-3">
                    {rules.allowance_granted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-secondary uppercase">
                        {rules.allowance_granted ? "Allowance Active" : "No Allowance"}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {rules.allowance_granted 
                          ? `${rules.hbar_allowance_amount} HBAR granted to KMS` 
                          : "KMS cannot sign without allowance"}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleGrantAllowance}
                    disabled={allowanceLoading}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      rules.allowance_granted 
                        ? "bg-white text-secondary border border-gray-200 hover:bg-gray-50" 
                        : "bg-primary text-secondary shadow-lg shadow-primary/20 hover:opacity-90"
                    }`}
                  >
                    {allowanceLoading ? "Granting..." : rules.allowance_granted ? "Update Allowance" : "Grant Allowance"}
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
              <p className="text-[11px] text-blue-700 leading-normal">
                Leave empty for <b>Non-Custodial Mode</b>. If empty, all device intents will require manual approval via the dashboard or WalletConnect.
              </p>
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
