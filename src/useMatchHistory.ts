import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { Chess } from "./chess";
import { historyKey, readHistory, saveHistory, type ArchivedMatch } from "./matchArchive";

export function mergeHistory(...lists: ArchivedMatch[][]): ArchivedMatch[] {
  const matches = new Map<string, ArchivedMatch>();
  for (const match of lists.flat()) {
    const previous = matches.get(match.id);
    if (!previous || Date.parse(match.updatedAt) > Date.parse(previous.updatedAt)) matches.set(match.id, match);
  }
  return [...matches.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

// Keep local account caches separate; interrupted uploads are retried after reload.
export function useMatchHistory(userId: string | null | undefined) {
  const scope = userId ?? null;
  const [cache, setCache] = useState<Record<string, ArchivedMatch[]>>(() => ({ guest: readHistory() }));
  const [localError, setLocalError] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const cacheRef = useRef(cache);
  const scopeKey = scope ?? "guest";
  const history = cache[scopeKey] ?? readHistory(scope);
  const dirty = useRef(new Map<string, Map<string, ArchivedMatch>>());
  const running = useRef(new Set<string>());
  const active = useRef(userId);
  active.current = userId;

  const store = useCallback((owner: string | null, matches: ArchivedMatch[]) => {
    const next = { ...cacheRef.current, [owner ?? "guest"]: matches };
    cacheRef.current = next;
    setCache(next);
    const saved = saveHistory(matches, owner);
    setLocalError(!saved);
    return saved;
  }, []);

  const sync = useCallback(async (owner: string, refresh = false) => {
    if (!supabase || running.current.has(owner) || active.current !== owner) return;
    running.current.add(owner);
    setSyncing(true);
    let failed = false;
    try {
      const queue = dirty.current.get(owner) ?? new Map<string, ArchivedMatch>();
      dirty.current.set(owner, queue);
      // Upload sequentially so a newer local move cannot be overtaken by an older one.
      while (queue.size) for (const [id, match] of [...queue]) {
        if (active.current !== owner) return;
        const game = new Chess();
        if (match.pgn) game.loadPgn(match.pgn);
        const { data, error } = await supabase.rpc("save_player_game", { p_game: match, p_ply_count: game.history().length, p_user_id: owner });
        if (error) throw error;
        if (queue.get(id) === match) {
          queue.delete(id);
          if (active.current === owner && data) {
            store(owner, (cacheRef.current[owner] ?? []).map((item) => item === match ? data as ArchivedMatch : item));
          }
        }
      }
      if (!refresh) return;
      const remote: ArchivedMatch[] = [];
      for (let offset = 0; ; offset += 500) {
        if (active.current !== owner) return;
        const { data, error } = await supabase.from("player_games").select("game").eq("user_id", owner)
          .order("id").range(offset, offset + 499);
        if (error) throw error;
        remote.push(...data.map((row) => row.game as ArchivedMatch));
        if (data.length < 500) break;
      }
      if (active.current === owner) store(owner, mergeHistory(remote, cacheRef.current[owner] ?? readHistory(owner)));
    } catch { failed = true; }
    finally {
      running.current.delete(owner);
      if (active.current === owner) { setCloudError(failed); setSyncing(false); }
    }
  }, [store]);

  useEffect(() => {
    setCloudError(false);
    setSyncing(false);
    if (!userId) return;
    // Claim guest history once, after writing the account copy successfully.
    const guest = readHistory();
    const matches = mergeHistory(readHistory(userId), guest);
    if (store(userId, matches) && guest.length) {
      try { localStorage.removeItem(historyKey()); } catch { /* Retain the recoverable guest copy. */ }
      cacheRef.current = { ...cacheRef.current, guest: [] };
      setCache(cacheRef.current);
    }
    dirty.current.set(userId, new Map(matches.map((match) => [match.id, match])));
    void sync(userId, true);
    const retry = () => { void sync(userId, true); };
    const timer = window.setInterval(retry, 15000);
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => { window.clearInterval(timer); window.removeEventListener("online", retry); window.removeEventListener("focus", retry); };
  }, [userId, store, sync]);

  const setHistory = useCallback((update: (previous: ArchivedMatch[]) => ArchivedMatch[]) => {
    if (userId === undefined) return;
    const previous = cacheRef.current[scopeKey] ?? readHistory(scope);
    const next = update(previous);
    store(scope, next);
    if (scope) {
      const queue = dirty.current.get(scope) ?? new Map<string, ArchivedMatch>();
      for (const match of next) if (previous.find((item) => item.id === match.id) !== match) queue.set(match.id, match);
      dirty.current.set(scope, queue);
      void sync(scope);
    }
  }, [scope, scopeKey, userId, store, sync]);

  return { history, setHistory, historyError: localError, historyCloudError: cloudError, historySyncing: syncing };
}
