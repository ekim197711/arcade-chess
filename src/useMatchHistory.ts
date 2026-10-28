import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { Chess } from "./chess";
import { historyKey, readHistory, saveHistory, type ArchivedMatch } from "./matchArchive";
import { readHomeOnce } from "./homeDataCache";

function sameMatch(a: ArchivedMatch, b: ArchivedMatch) {
  // JSONB can return keys in a different order than local browser storage.
  return (Object.keys({ ...a, ...b }) as (keyof ArchivedMatch)[]).every(key =>
    a[key] === b[key] || (key === "moveTimesMs" && JSON.stringify(a[key]) === JSON.stringify(b[key])));
}

export function mergeHistory(...lists: ArchivedMatch[][]): ArchivedMatch[] {
  const matches = new Map<string, ArchivedMatch>();
  for (const match of lists.flat()) {
    const previous = matches.get(match.id);
    if (!previous || Date.parse(match.updatedAt) > Date.parse(previous.updatedAt)) matches.set(match.id, match);
  }
  return [...matches.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

// Keep local account caches separate; interrupted uploads are retried after reload.
export function useMatchHistory(userId: string | null | undefined, allowAutomaticSync = true) {
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
  const automaticSync = useRef(allowAutomaticSync); automaticSync.current = allowAutomaticSync;
  const urgent = useRef(new Set<string>());
  const nextPage = useRef(new Map<string, number>());
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyPending, setHistoryPending] = useState(0);
  const persistPending = (owner: string) => {
    const ids = [...(dirty.current.get(owner)?.keys() ?? [])];
    try { localStorage.setItem(`${historyKey(owner)}:pending`, JSON.stringify(ids)); } catch { /* The in-memory queue remains available. */ }
    if (active.current === owner) setHistoryPending(ids.length);
  };
  const active = useRef(userId);
  active.current = userId;

  const store = useCallback((owner: string | null, matches: ArchivedMatch[]) => {
    const previous = cacheRef.current[owner ?? "guest"];
    if (previous?.length === matches.length && previous.every((match, index) => sameMatch(match, matches[index]))) {
      // Retry storage after an earlier failure before claiming a guest copy.
      const saved = saveHistory(matches, owner);
      setLocalError(!saved);
      return saved;
    }
    const next = { ...cacheRef.current, [owner ?? "guest"]: matches };
    cacheRef.current = next;
    setCache(next);
    const saved = saveHistory(matches, owner);
    setLocalError(!saved);
    return saved;
  }, []);

  const sync = useCallback(async (owner: string, refresh = false, explicit = false, offset = 0): Promise<void> => {
    if (!supabase || running.current.has(owner) || active.current !== owner) return;
    running.current.add(owner);
    setSyncing(true);
    let failed = false;
    try {
      const queue = dirty.current.get(owner) ?? new Map<string, ArchivedMatch>();
      dirty.current.set(owner, queue);
      if (refresh) {
        // Compare the cloud copy before uploading cached games after a reload.
        const client = supabase;
        const { data, error } = await readHomeOnce(owner, `boss-history:${offset}`, () => client.from("player_games").select("game").eq("user_id", owner)
          .order("updated_at", { ascending: false }).order("id").range(offset, offset + 49));
        if (active.current !== owner) return;
        if (error) throw error;
        const remote = data.map(row => row.game as ArchivedMatch);
        nextPage.current.set(owner, offset + remote.length);
        setHistoryHasMore(remote.length === 50);
        const remoteById = new Map(remote.map(match => [match.id, match]));
        for (const [id, match] of queue) {
          const saved = remoteById.get(id);
          if (saved && sameMatch(saved, match)) queue.delete(id);
        }
        const merged = mergeHistory(remote, cacheRef.current[owner] ?? readHistory(owner));
        // A newer remote timestamp must not overwrite a queued local move before
        // the save RPC has reconciled it, including after an offline reload.
        store(owner, mergeHistory(merged.map(match => queue.get(match.id) ?? match)));
      }
      // Upload sequentially so a newer local move cannot be overtaken by an older one.
      if (!automaticSync.current && !explicit) return;
      urgent.current.delete(owner);
      // Bound every flush; home never flushes without a button click.
      for (const [id, match] of [...queue].slice(0, 5)) {
        if (!automaticSync.current && !explicit) break;
        if (active.current !== owner) return;
        const game = new Chess();
        if (match.pgn) game.loadPgn(match.pgn);
        const { data, error } = await supabase.rpc("save_player_game", { p_game: match, p_ply_count: game.history().length, p_user_id: owner });
        if (error) throw error;
        if (queue.get(id) === match) {
          queue.delete(id);
          if (active.current === owner && data) {
            store(owner, (cacheRef.current[owner] ?? []).map((item) => item.id === id ? data as ArchivedMatch : item));
          }
        }
      }
    } catch { failed = true; }
    finally {
      persistPending(owner);
      running.current.delete(owner);
      const saveAgain = urgent.current.delete(owner);
      if (active.current === owner) { setCloudError(failed); setSyncing(false); }
      if (saveAgain && automaticSync.current && active.current === owner) void sync(owner);
    }
  }, [store]);

  useEffect(() => {
    setCloudError(false);
    setSyncing(false);
    setHistoryHasMore(false);
    setHistoryPending(0);
    if (!userId) return;
    // Claim guest history once, after writing the account copy successfully.
    const guest = readHistory();
    const matches = mergeHistory(readHistory(userId), guest);
    if (store(userId, matches) && guest.length) {
      try { localStorage.removeItem(historyKey()); } catch { /* Retain the recoverable guest copy. */ }
      cacheRef.current = { ...cacheRef.current, guest: [] };
      setCache(cacheRef.current);
    }
    let pendingIds: string[] | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(`${historyKey(userId)}:pending`) ?? "null");
      if (Array.isArray(saved)) pendingIds = saved.filter((id): id is string => typeof id === "string");
    } catch { /* Legacy caches are verified once before upload. */ }
    const ids = new Set([...(pendingIds ?? matches.map(match => match.id)), ...guest.map(match => match.id)]);
    dirty.current.set(userId, new Map(matches.filter(match => ids.has(match.id)).map(match => [match.id, match])));
    persistPending(userId);
    void sync(userId, true);
    const reconnect = () => {
      if (automaticSync.current && !document.hidden && dirty.current.get(userId)?.size) void sync(userId);
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [userId, store, sync]);

  const setHistory = useCallback((update: (previous: ArchivedMatch[]) => ArchivedMatch[]) => {
    if (userId === undefined) return;
    const previous = cacheRef.current[scopeKey] ?? readHistory(scope);
    const next = update(previous);
    store(scope, next);
    if (scope) {
      const queue = dirty.current.get(scope) ?? new Map<string, ArchivedMatch>();
      const changed = next.filter(match => {
        const old = previous.find(item => item.id === match.id);
        return !old || !sameMatch(old, match);
      });
      for (const match of changed) queue.delete(match.id);
      const remaining = [...queue]; queue.clear();
      for (const match of changed) queue.set(match.id, match);
      for (const [id, match] of remaining) queue.set(id, match);
      dirty.current.set(scope, queue);
      persistPending(scope);
      if (automaticSync.current && changed.length) {
        urgent.current.add(scope);
        void sync(scope);
      }
    }
  }, [scope, scopeKey, userId, store, sync]);

  const refreshHistory = useCallback(() => userId ? sync(userId, true, true) : Promise.resolve(), [userId, sync]);
  const loadOlderHistory = useCallback(() => userId ? sync(userId, true, false, nextPage.current.get(userId) ?? 50) : Promise.resolve(), [userId, sync]);
  return { history, setHistory, refreshHistory, loadOlderHistory, historyHasMore, historyPending, historyError: localError, historyCloudError: cloudError, historySyncing: syncing };
}
