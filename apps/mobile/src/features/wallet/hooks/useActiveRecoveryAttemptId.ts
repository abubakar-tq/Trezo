import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Address } from "viem";

import { getSupabaseClient } from "@lib/supabase";

// ADR-0009: the "Recovery Attempt in progress" banner reads only Supabase —
// a single existence SELECT — and never pays an RPC call. Detail screen is
// where chain reads happen. See CONTEXT.md "RPC budget for chain reads".
export function useActiveRecoveryAttemptId(smartAccountAddress: Address | undefined): {
  attemptId: string | null;
  loading: boolean;
} {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = async () => {
    if (!smartAccountAddress) {
      setAttemptId(null);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("email_recovery_groups")
      .select("id")
      .eq("smart_account_address", smartAccountAddress.toLowerCase())
      .is("deleted_at", null)
      .is("executed_at", null)
      .limit(1)
      .maybeSingle();

    setAttemptId(data?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void fetch();

    // Refresh every 30 s while foregrounded
    timerRef.current = setInterval(() => void fetch(), 30_000);

    // Also refresh on app foreground
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void fetch();
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartAccountAddress]);

  return { attemptId, loading };
}
