import { supabase } from "@/lib/supabase";

export async function fetchRules(userId: string) {
  const { data } = await supabase.from("rules").select("*").eq("user_id", userId).single();
  return data;
}

export async function saveRules(userId: string, rules: any) {
  const updates = {
    user_id: userId,
    swap_amount: rules.swap_amount,
    max_per_swap: rules.max_per_swap,
    daily_limit: rules.daily_limit,
    cooldown_seconds: rules.cooldown_seconds,
    slippage_tolerance: rules.slippage_tolerance,
    updated_at: new Date().toISOString()
  };

  return await supabase.from("rules").upsert(updates, { onConflict: 'user_id' });
}

export async function checkRealtimeAllowance(address: string, spenderId: string) {
  try {
    let accountId = address;
    if (address.startsWith("0x")) {
      try {
        const res = await fetch(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${address}`);
        const data = await res.json();
        if (data?.account) accountId = data.account;
      } catch {
        // fallback
      }
    }

    const res = await fetch(
      `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${accountId}/allowances/crypto`
    );

    if (!res.ok) return { status: "error" };

    const data = await res.json();
    if (data?._status?.messages) return { status: "error" };

    if (data?.allowances) {
      const platformAllowance = data.allowances.find(
        (a: any) => a.spender === spenderId
      );

      if (platformAllowance) {
        const rawAmount = platformAllowance.amount ?? platformAllowance.amount_granted ?? 0;
        const remainingHbar = Number(rawAmount) / 100_000_000;
        return {
          status: "success",
          allowance_granted: remainingHbar > 0,
          hbar_allowance_amount: remainingHbar,
        };
      }
    }
    return { status: "success", allowance_granted: false, hbar_allowance_amount: 0 };
  } catch (error) {
    return { status: "error" };
  }
}
