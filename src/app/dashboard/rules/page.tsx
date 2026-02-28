"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAppKitAccount } from "@reown/appkit/react";
import { Shield, Save, AlertCircle, Clock, Percent, DollarSign, Wallet } from "lucide-react";

export default function RulesPage() {
  const { address } = useAppKitAccount();
  const [rules, setRules] = useState({
    max_per_swap: 100,
    daily_limit: 1000,
    cooldown_seconds: 60,
    slippage_tolerance: 0.5,
  });
  const [kmsArn, setKmsArn] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchRules();
  }, [address]);

  async function fetchRules() {
    if (!address) return;

    // Use wallet address as the unique identifier for the profile/user
    const { data: profile } = await supabase.from("profiles").select("id").eq("wallet_address", address).single();
    let userId = profile?.id;

    if (!userId) {
      // Create profile if it doesn't exist
      const { data: newProfile } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(), // Mocking a UUID for the profile
        wallet_address: address,
      }).select().single();
      userId = newProfile?.id;
    }

    if (!userId) return;

    const { data: rulesData } = await supabase.from("rules").select("*").eq("user_id", userId).single();
    if (rulesData) setRules(rulesData);

    const { data: keyData } = await supabase.from("wallet_keys").select("kms_arn").eq("user_id", userId).single();
    if (keyData) setKmsArn(keyData.kms_arn);
  }

  async function handleSave() {
    if (!address) return;
    setLoading(true);

    let { data: profile } = await supabase.from("profiles").select("id").eq("wallet_address", address).single();
    let userId = profile?.id;

    if (!userId) {
      const { data: newProfile } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(),
        wallet_address: address,
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
        await supabase.from("wallet_keys").upsert({
          user_id: userId,
          kms_arn: kmsArn,
        });
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
