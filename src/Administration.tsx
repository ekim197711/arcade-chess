import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { roleLabel, type AppRole } from "./useAdministration";
import "./administration.css";
import { BuildVersion } from "./BuildVersion";

type Statistics = { users: number; online: number; games: { today: number; hour: number; week: number; month: number }; asOf: string };
type ManagedUser = { id: string; email: string; name?: string; role: AppRole; verified: boolean; status: "active" | "banned" | "suspended"; until?: string | null; reason?: string | null };

export function Administration({ userId, role }: { userId?: string; role: AppRole | null }) {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const allowed = !!userId && role === "administrator";
  const refresh = useCallback(async () => {
    if (!supabase || !allowed || busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const { data, error: failure } = await supabase.rpc("admin_statistics");
      if (!mounted.current) return;
      if (failure) throw failure;
      setStatistics(data as Statistics);
      setError("");
    } catch {
      if (mounted.current) {
        setStatistics(null);
        setError("Statistics could not be loaded. Check your administrator access and try again.");
      }
    } finally { busy.current = false; if (mounted.current) setLoading(false); }
  }, [allowed]);
  useEffect(() => {
    if (!allowed) { setStatistics(null); return; }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [allowed, refresh]);

  return <section className="administration-page" aria-labelledby="administration-title">
    <a className="admin-back" href="#home">← Back to home</a>
    <div className="admin-heading"><div><p>ARCADE GAMBIT / ADMINISTRATION</p><h1 id="administration-title">Administration</h1></div>
      {allowed && <button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh statistics"}</button>}
    </div>
    {!allowed ? <p role="status">{!userId ? "Sign in with an administrator account to view statistics." : role === "user" ? "Administrator access is required to view this page." : "Checking administrator access. If this continues, check your connection and reload the page."}</p> : <>
      <p className="admin-role">{roleLabel(role!)}</p>
      <BuildVersion />
      {error && <p role="alert">{error}</p>}
      {!statistics && loading && <p role="status">Loading statistics…</p>}
      {statistics && <>
        <div className="admin-stat-grid" aria-label="Site statistics">
          {[
            ["Total signed-up users", statistics.users], ["Online now", statistics.online],
            ["Games played today", statistics.games.today], ["Games played in the last hour", statistics.games.hour],
            ["Games played in the last week", statistics.games.week], ["Games played in the last month", statistics.games.month],
          ].map(([label, value]) => <article className="admin-stat" key={label}><h2>{label}</h2><strong>{Number(value).toLocaleString()}</strong></article>)}
        </div>
        <p className="admin-note">Updated {new Date(statistics.asOf).toLocaleString()}. Refreshes every 30 seconds while this page is visible.</p>
      </>}
      <p className="admin-note">Online now counts signed-in users active in a visible tab within the last 90 seconds, once per account. Total users includes unconfirmed signups and excludes deleted accounts.</p>
      <p className="admin-note">Game totals count completed Standard, Freestyle, human and practice bot games saved to the server. Each match counts once. Debug games and guest games stored only on a device are excluded. Today starts at midnight in Europe/Copenhagen; week and month mean the last 7 and 30 days.</p>
      <AdministratorManagement userId={userId!} />
    </>}
  </section>;
}

function AdministratorManagement({ userId }: { userId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [moderation, setModeration] = useState<{ user: ManagedUser; action: "ban" | "suspend" | "restore" } | null>(null);
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(24);
  const alive = useRef(true);
  const generation = useRef(0);
  const savingRef = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async (query: string, page: number) => {
    if (!supabase) return;
    const request = ++generation.current;
    setLoading(true); setError(""); setMessage("");
    try {
      const { data, error: failure } = await supabase.rpc("admin_users", { p_search: query.trim(), p_offset: page });
      if (!alive.current || request !== generation.current) return;
      if (failure) throw failure;
      setUsers(data as ManagedUser[]); setOffset(page); setAppliedSearch(query);
    } catch { if (alive.current && request === generation.current) { setUsers([]); setError("Users could not be loaded. Please try searching again."); } }
    finally { if (alive.current && request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void load("", 0); }, [load]);
  async function changeRole(user: ManagedUser) {
    if (!supabase || savingRef.current) return;
    const enabled = user.role !== "administrator";
    savingRef.current = true; setSaving(user.id); setError(""); setMessage("");
    try {
      const { error: failure } = await supabase.rpc("admin_set_administrator", { p_user_id: user.id, p_enabled: enabled });
      if (!alive.current) return;
      if (failure) throw failure;
      setUsers(previous => previous.map(row => row.id === user.id ? { ...row, role: enabled ? "administrator" : "user" } : row));
      setMessage(`${user.email} is now ${enabled ? "an administrator" : "a user"}.`);
    } catch { if (alive.current) setError("The role could not be changed. Check that the account still exists and has a verified email, then try again."); }
    finally { savingRef.current = false; if (alive.current) setSaving(null); }
  }
  async function moderate() {
    if (!supabase || !moderation || savingRef.current || !reason.trim()) return;
    const { user, action } = moderation;
    const until = action === "suspend" ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
    savingRef.current = true; setSaving(user.id); setError(""); setMessage("");
    try {
      const { error: failure } = await supabase.rpc("admin_moderate_user", { p_user_id: user.id, p_action: action, p_reason: reason.trim(), p_until: until });
      if (!alive.current) return;
      if (failure) throw failure;
      setUsers(previous => previous.map(row => row.id === user.id ? { ...row, status: action === "restore" ? "active" : action === "ban" ? "banned" : "suspended", until, reason: action === "restore" ? null : reason.trim() } : row));
      setModeration(null);
      setMessage(`${user.email}: ${action === "restore" ? "access restored" : action === "ban" ? "banned" : "suspended"}.`);
    } catch { if (alive.current) setError("The account action failed. Check your administrator access and try again."); }
    finally { savingRef.current = false; if (alive.current) setSaving(null); }
  }
  return <section className="admin-users" aria-labelledby="admin-users-title">
    <h2 id="admin-users-title">Manage users & administrators</h2>
    <p>Every administrator can grant or remove administrator access, ban users, suspend them temporarily, or restore access. Ask another administrator to change your own account.</p>
    <form className="admin-search" onSubmit={event => { event.preventDefault(); void load(search, 0); }}>
      <label htmlFor="admin-user-search">Find users by email or name</label>
      <div><input id="admin-user-search" type="search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder="Email address" />
        <button type="submit" disabled={loading || !!saving}>Search users</button></div>
    </form>
    {error && <p role="alert">{error}</p>}
    <p role="status">{loading ? "Loading users…" : message}</p>
    {!loading && users.length === 0 && !error && <p>No users found.</p>}
    <ul className="admin-user-list">{users.map(user => <li key={user.id}>
      <div><strong>{user.email}</strong>{user.name && <span>{user.name}</span>}<span>{roleLabel(user.role)}{!user.verified && " · Email not verified"}</span>
        <span>{user.status === "banned" ? "Banned" : user.status === "suspended" ? `Suspended until ${user.until ? new Date(user.until).toLocaleString() : "further notice"}` : "Active"}</span>{user.reason && <span>{user.reason}</span>}</div>
      {user.id === userId ? <span className="admin-protected">Your account</span> : <div className="admin-user-actions"><button type="button" disabled={loading || !!saving || ((!user.verified || user.status !== "active") && user.role !== "administrator")} onClick={() => void changeRole(user)}>
        {saving === user.id ? "Saving…" : user.role === "administrator" ? "Remove administrator" : "Make administrator"}
      </button>
        {(user.status === "active" ? ["suspend", "ban"] as const : ["restore"] as const).map(action => <button type="button" key={action} disabled={loading || !!saving}
          onClick={() => { setModeration({ user, action }); setReason(action === "restore" ? "Access restored by administrator" : ""); setHours(24); setError(""); }}>
          {action === "suspend" ? "Suspend user" : action === "ban" ? "Ban user" : "Restore access"}
        </button>)}
      </div>}
    </li>)}</ul>
    {moderation && <form className="admin-moderation" aria-label="Confirm account action" onSubmit={event => { event.preventDefault(); void moderate(); }}>
      <h3>{moderation.action === "ban" ? "Ban" : moderation.action === "suspend" ? "Suspend" : "Restore access for"} {moderation.user.email}?</h3>
      <p>{moderation.action === "ban" ? "This blocks the account until an administrator restores access." : moderation.action === "suspend" ? "The account regains access automatically when this period ends." : "This removes the account restriction."}</p>
      {moderation.action !== "restore" && <p>Any active match ends as an unrated forfeit.</p>}
      {moderation.action === "suspend" && <label>Suspension duration<select value={hours} onChange={event => setHours(Number(event.target.value))} disabled={!!saving}>
        {[1,24,168,720].map(value => <option key={value} value={value}>{value === 1 ? "1 hour" : value === 24 ? "1 day" : value === 168 ? "7 days" : "30 days"}</option>)}
      </select></label>}
      <label>Reason<textarea autoFocus required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={!!saving} /></label>
      <button type="submit" disabled={!!saving || !reason.trim()}>{moderation.action === "ban" ? "Confirm ban" : moderation.action === "suspend" ? "Confirm suspension" : "Confirm restore access"}</button>{" "}
      <button type="button" disabled={!!saving} onClick={() => setModeration(null)}>Cancel</button>
    </form>}
    <div className="admin-pagination"><button type="button" disabled={loading || !!saving || offset === 0} onClick={() => void load(appliedSearch, Math.max(0, offset - 50))}>Previous users</button>
      <span>Page {offset / 50 + 1}</span><button type="button" disabled={loading || !!saving || users.length < 50} onClick={() => void load(appliedSearch, offset + 50)}>Next users</button></div>
  </section>;
}
