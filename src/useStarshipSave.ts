import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { mergeStarship, normalizeStarship, starshipKey, type StarshipSave } from "./starshipRules";

function read(owner: string) {
  try { return normalizeStarship(JSON.parse(localStorage.getItem(starshipKey(owner)) ?? "null")); }
  catch { return normalizeStarship(null); }
}

// Mounted only inside the mini game. Saves are monotonic and safe to retry.
export function useStarshipSave(owner: string) {
  const [save, setSave] = useState(() => read(owner));
  const current = useRef(save);
  const [status, setStatus] = useState("Progress saved on this device.");
  const alive = useRef(true);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const deviceSaved = useRef(true);
  function local(next: StarshipSave) {
    next = mergeStarship(next, read(owner));
    current.current = next;
    setSave(next);
    try { localStorage.setItem(starshipKey(owner), JSON.stringify(next)); deviceSaved.current = true; return true; }
    catch { deviceSaved.current = false; setStatus("Device storage is unavailable. Keep this page open to retain progress."); return false; }
  }
  async function sync() {
    if (owner === "guest" || !supabase) return;
    if (inFlight.current) { queued.current = true; return; }
    inFlight.current = true;
    try {
      do {
        queued.current = false;
        const snapshot = current.current;
        const { data, error } = await supabase.rpc("save_starship_progress", { p_repaired: snapshot.repaired, p_launched: snapshot.launched });
        if (!alive.current) return;
        if (error) { setStatus(deviceSaved.current ? "Cloud save pending. Progress stays on this device; use Retry cloud save when connected." : "Cloud save pending and device storage unavailable. Keep this page open and retry."); break; }
        const stored = local(mergeStarship(current.current, normalizeStarship(data)));
        setStatus(stored ? "Progress saved on this device and to your account." : "Saved to your account. Device storage is unavailable.");
      } while (queued.current);
    } catch {
      if (alive.current) setStatus("Cloud save pending. Use Retry cloud save when connected.");
    } finally { inFlight.current = false; }
  }
  useEffect(() => {
    alive.current = true;
    // Carry guest repairs into the signed-in account without touching ladder stats.
    if (owner !== "guest" && local(mergeStarship(current.current, read("guest")))) {
      try { localStorage.removeItem(starshipKey("guest")); } catch { /* Account copy is safe. */ }
    }
    void sync();
    return () => { alive.current = false; };
  }, [owner]);
  function commit(next: StarshipSave) {
    const stored = local(mergeStarship(current.current, next));
    if (stored) setStatus(owner === "guest" || !supabase ? "Progress saved on this device." : "Saved on this device. Syncing account…");
    void sync();
  }
  return { save, commit, status, retry: sync };
}
