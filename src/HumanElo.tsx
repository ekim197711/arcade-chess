import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { readHomeOnce } from "./homeDataCache";

export function HumanElo({ userId, refreshToken = 0 }: { userId?: string; refreshToken?: number }) {
  const [rating, setRating] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !supabase) return;
    const client = supabase;
    let active = true;
    const refresh = async () => {
      try {
        const { data, error } = await readHomeOnce(userId, "rating", () => client.from("online_players")
          .select("rating").eq("user_id", userId).maybeSingle());
        // Accounts receive the initial rating when they first join online play.
        if (active && !error) setRating(data?.rating ?? 1200);
      } catch { /* Keep the last confirmed rating during connection failures. */ }
    };
    void refresh();
    return () => { active = false; };
  }, [userId, refreshToken]);

  return <span className="hud-player-elo" title="Your internal online rating from games against human players">
    HUMAN ELO <strong>{userId ? rating ?? "—" : "Sign in"}</strong>
  </span>;
}
