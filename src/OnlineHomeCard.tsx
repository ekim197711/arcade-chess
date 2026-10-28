import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { reconnectDeadline, type OnlineGame } from "./onlineChess";
import "./online.css";

export function OnlineHomeCard({ userId, navigate }: { userId: string; navigate: (route: string) => void }) {
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0), inFlight = useRef(false), active = useRef(true);
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const lastRefresh = useRef(0);
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
    lastRefresh.current = Date.now();
    let release!: () => void;
    pendingRefresh.current = new Promise<void>(resolve => { release = resolve; });
    if (resign) setBusy(true);
    try {
      const { data, error: failure } = await supabase.functions.invoke<{ game: OnlineGame | null; server_now: string; error?: string }>("multiplayer", {
        body: resign ? { action: "resign", game_id: current!.id } : { action: "active" },
      });
      if (failure || !data || data.error) throw new Error(data?.error ?? "Could not check your current game. Please retry.");
      if (!active.current) return;
      offset.current = Date.parse(data.server_now) - Date.now(); setNow(Date.parse(data.server_now));
      // Keep the just-finished result available after a forfeit or resignation.
      setGame(previous => data.game ?? (previous?.result ? previous : null));
      setError("");
      if (resign) {
        setConfirmResign(false);
        if (data.game?.result) navigate(`online/${data.game.id}`);
      }
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : "Online play is unavailable.");
    } finally { inFlight.current = false; release(); if (active.current) { setLoading(false); setBusy(false); } }
  }
  useEffect(() => {
    active.current = true;
    void refresh();
    const focus = () => {
      const current = gameRef.current;
      const deadline = current ? reconnectDeadline(current, current.black_id === userId ? "b" : "w") : null;
      const expired = deadline !== null && deadline <= Date.now() + offset.current;
      if (!document.hidden && navigator.onLine && (expired || Date.now() - lastRefresh.current >= 60000)) void refresh();
    };
    const reconnect = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", focus); window.addEventListener("online", reconnect);
    return () => { active.current = false; window.removeEventListener("focus", focus); window.removeEventListener("online", reconnect); };
  }, [userId]);
  const side = game?.black_id === userId ? "b" : "w";
  const deadline = game ? reconnectDeadline(game, side) : null;
  useEffect(() => {
    if (deadline === null) return;
    // Render the countdown locally; only contact the server once it expires.
    const clock = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now() + offset.current);
    }, 1000);
    const expiry = window.setTimeout(() => {
      if (!document.hidden && navigator.onLine) void refresh();
    }, Math.max(0, deadline - Date.now() - offset.current) + 250);
    return () => { window.clearInterval(clock); window.clearTimeout(expiry); };
  }, [deadline]);
  const seconds = game ? Math.max(0, Math.ceil(((reconnectDeadline(game,side) ?? now) - now) / 1000)) : 0;
  return <section className="online-home-card" aria-labelledby="online-home-title">
    <h2 id="online-home-title">Play against human</h2>
    {game && !game.result ? <>
      <p>Your {game.minutes}-minute {game.is_bot ? "practice game" : "human match"} against <strong>{side === "w" ? game.black_name : game.white_name}</strong> is in progress.</p>
      <p className="online-home-countdown" role="timer" aria-label="Seconds before auto-resign">Auto-resign in <strong>{seconds}</strong> seconds while away. Your game clock keeps running.</p>
      <div className="online-home-actions"><button onClick={() => navigate(`online/${game.id}`)}>Resume</button>
        <button disabled={busy} onClick={() => setConfirmResign(true)}>Resign current game</button></div>
      {confirmResign && <div className="online-home-confirm"><p>Resign your current game?</p><button disabled={busy} onClick={() => void refresh(true)}>{busy ? "Resigning…" : "Confirm resignation"}</button><button disabled={busy} onClick={() => setConfirmResign(false)}>Keep playing</button></div>}
    </> : <>
      {game?.result && <p role="status">Your previous game ended: {game.result} · {game.reason}. <button onClick={() => navigate(`online/${game.id}`)}>View game summary</button></p>}
      <p>Find a player near your overall Elo. Choose a 3, 5, 10 or 15 minute clock, build your rating, and replay community games.</p>
      <button disabled={loading} onClick={() => navigate("online")}>Play against human</button>
    </>}
    {error && <p role="alert">{error} <button disabled={busy} onClick={() => void refresh()}>Retry</button></p>}
  </section>;
}
