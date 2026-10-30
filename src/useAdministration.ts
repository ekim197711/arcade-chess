import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type AppRole = "user" | "administrator";
export type AccountRestriction = { status: "banned" | "suspended"; reason?: string; until?: string | null };
export const roleLabel = (role: AppRole) => role === "administrator" ? "Administrator" : "User";

export function useAdministration(userId: string | undefined) {
  const [state, setState] = useState<{ userId: string; role: AppRole | null; restriction: AccountRestriction | null } | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    let disposed = false;
    let busy = false;
    let lastAttempt = 0;
    const heartbeat = async () => {
      if (document.visibilityState !== "visible" || busy || Date.now() - lastAttempt < 25_000) return;
      busy = true;
      lastAttempt = Date.now();
      try {
        const { data, error } = await client.rpc("app_heartbeat");
        if (disposed) return;
        if (!error && (data === "banned" || data === "suspended")) {
          setState({ userId, role: null, restriction: { status: data } });
          const status = await client.rpc("app_account_status");
          if (!disposed && !status.error && status.data?.status !== "active") setState({ userId, role: null, restriction: status.data as AccountRestriction });
        } else if (error || !["user", "administrator"].includes(data)) {
          setState(current => current?.userId === userId && current.restriction ? current : null);
        } else setState({ userId, role: data as AppRole, restriction: null });
      } catch { if (!disposed) setState(current => current?.userId === userId && current.restriction ? current : null); }
      finally { busy = false; }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [userId]);
  return state?.userId === userId ? state : null;
}
