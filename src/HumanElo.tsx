import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function HumanElo({ userId }: { userId?: string }) {
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !supabase) return;
    const client = supabase;
    let active = true;
    let inFlight = false;
    let lastRefresh = 0;
    const refresh = async (force = false) => {
      if (inFlight || document.hidden || !navigator.onLine || (!force && Date.now() - lastRefresh < 60000)) return;
      lastRefresh = Date.now();
      inFlight = true;
      try {
        const { data, error } = await client.from("online_players")
          .select("rating").eq("user_id", userId).maybeSingle();
        // Accounts receive the initial rating when they first join online play.
        if (active && !error) setRating(data?.rating ?? 1200);
      } catch { /* Keep the last confirmed rating during connection failures. */ }
      finally { inFlight = false; }
    };
    void refresh();
    const focus = () => void refresh();
    const retry = () => void refresh(true);
    window.addEventListener("focus", focus);
    window.addEventListener("online", retry);
    return () => {
      active = false;
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", retry);
    };
  }, [userId]);

  return <span className="hud-player-elo" title="Your internal online rating from games against human players">
    HUMAN ELO <strong>{userId ? rating ?? "—" : "Sign in"}</strong>
  </span>;
}
