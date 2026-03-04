"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAppKitAccount } from "@reown/appkit/react";

export function useProfile() {
  const { address } = useAppKitAccount();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!address) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, is_admin")
        .or(`wallet_address.ilike.${address},wallet_address.eq.${address}`)
        .limit(1)
        .maybeSingle();

      if (data) {
        setUserId(data.id);
        setIsAdmin(data.is_admin || false);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [address]);

  return { userId, isAdmin, loading, address };
}
