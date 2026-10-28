import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { reconnectDeadline, type OnlineGame } from "./onlineChess";
import "./online.css";
import { readHomeOnce, invalidateHomeData } from "./homeDataCache";

type HomeGame = Pick<OnlineGame, "id" | "white_id" | "black_id" | "white_name" | "black_name" | "minutes" | "is_bot" | "result" | "reason" | "white_seen_at" | "black_seen_at" | "white_disconnected_at" | "black_disconnected_at">;

export function OnlineHomeCard({ userId, navigate, refreshToken = 0 }: { userId: string; navigate: (route: string) => void; refreshToken?: number }) {
  const [game, setGame] = useState<HomeGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false), active = useRef(true);
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const gameRef = useRef(game); gameRef.current = game;
  async function refresh(resign = false): Promise<void> {
    if (!supabase) return;
    if (inFlight.current) {
      if (!resign) return;
      await pendingRefresh.current;
      if (active.current) return refresh(true);
      return;
    }
    const current = gameRef.current;
    if (resign && (!current || current.result)) return;
    inFlight.current = true;
    let release!: () => void;
    pendingRefresh.current = new Promise<void>(resolve => { release = resolve; });
    if (resign) setBusy(true);
    try {
      if (resign) {
        const { data, error: failure } = await supabase.functions.invoke<{ game: OnlineGame | null; error?: string }>("multiplayer", {
          body: { action: "resign", game_id: current!.id },
        });
        if (failure || !data || data.error) throw new Error(data?.error ?? "Could not resign your game. Please retry.");
        if (!active.current) return;
        setGame(data.game);
        setConfirmResign(false);
        if (data.game?.result) navigate(`online/${data.game.id}`);
      } else {
        // Read-only, bounded snapshot. Visiting home must not invoke the game engine.
        const client = supabase;
        const { data, error: failure } = await readHomeOnce(userId, "active-game", () => client.from("online_games")
          .select("id,white_id,black_id,white_name,black_name,minutes,is_bot,result,reason,white_seen_at,black_seen_at,white_disconnected_at,black_disconnected_at")
          .is("result", null).or(`white_id.eq.${userId},black_id.eq.${userId}`).limit(1).maybeSingle());
        if (failure) throw new Error("Could not check your current game. Use Refresh saved data to retry.");
        if (!active.current) return;
        setGame(data as HomeGame | null);
        setNow(Date.now());
      }
      setError("");
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : "Online play is unavailable.");
    } finally { inFlight.current = false; release(); if (active.current) { setLoading(false); setBusy(false); } }
  }
  useEffect(() => {
    active.current = true;
    void refresh();
    return () => { active.current = false; };
  }, [userId, refreshToken]);
  const side = game?.black_id === userId ? "b" : "w";
  const deadline = game ? reconnectDeadline(game, side) : null;
  useEffect(() => {
    if (deadline === null || deadline <= Date.now()) return;
    // Display only: expiry never makes a network request from home.
    const clock = window.setInterval(() => {
      const stamp = Date.now();
      if (!document.hidden || stamp >= deadline) setNow(stamp);
      if (stamp >= deadline) window.clearInterval(clock);
    }, 1000);
    return () => window.clearInterval(clock);
  }, [deadline]);
  const seconds = game ? Math.max(0, Math.ceil(((reconnectDeadline(game,side) ?? now) - now) / 1000)) : 0;
  return <section className="online-home-card" aria-labelledby="online-home-title">
    <h2 id="online-home-title">Play against human</h2>
    {game && !game.result ? <>
      <p>Your {game.minutes}-minute {game.is_bot ? "practice game" : "human match"} against <strong>{side === "w" ? game.black_name : game.white_name}</strong> is in progress.</p>
      <p className="online-home-countdown" role="timer" aria-label="Seconds before auto-resign">{seconds > 0 ? <>About <strong>{seconds}</strong> seconds before auto-resign while away. Your game clock keeps running.</> : <>Reconnect deadline reached. Open your game to check its result.</>}</p>
      <div className="online-home-actions"><button onClick={() => navigate(`online/${game.id}`)}>Resume</button>
        <button disabled={busy} onClick={() => setConfirmResign(true)}>Resign current game</button></div>
      {confirmResign && <div className="online-home-confirm"><p>Resign your current game?</p><button disabled={busy} onClick={() => void refresh(true)}>{busy ? "Resigning…" : "Confirm resignation"}</button><button disabled={busy} onClick={() => setConfirmResign(false)}>Keep playing</button></div>}
    </> : <>
      {game?.result && <p role="status">Your previous game ended: {game.result} · {game.reason}. <button onClick={() => navigate(`online/${game.id}`)}>View game summary</button></p>}
      <p>Find a player near your overall Elo. Choose a 3, 5, 10 or 15 minute clock, build your rating, and replay community games.</p>
      <button disabled={loading} onClick={() => navigate("online")}>Play against human</button>
    </>}
    {error && <p role="alert">{error} <button disabled={busy || loading} onClick={() => { invalidateHomeData(userId); void refresh(); }}>Retry</button></p>}
  </section>;
}
