import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import type { OnlineGame } from "./onlineChess";
import { BotBoardReactions } from "./BotBoardReactions";
import { EMOJI_REACTIONS } from "./emojiReactions";
import { CommunicationTabs } from "./CommunicationTabs";
import { BotChat } from "./BotChat";
import type { BotGame } from "./fallbackBotReactions";
import "./onlineSocial.css";

type Friend = { user_id: string; name: string; accepted: boolean; requested_by: string };
type Message = { id: number; sender_id: string; body: string; created_at: string };
type SocialState = { friends: Friend[]; messages: Message[]; reactions: Message[]; emojis_enabled: boolean; peer_emojis_enabled: boolean };

export function OnlineSocial({ userId, game }: { userId: string; game?: OnlineGame }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (game && ![game.white_id, game.black_id].includes(userId)) return null;
  const peer = game ? game.white_id === userId ? game.black_id : game.white_id : selected;
  const name = game ? game.white_id === userId ? game.black_name : game.white_name : undefined;
  return <SocialContent key={`${userId}:${game?.id ?? "lobby"}:${peer}`} userId={userId} gameId={game?.id} peer={peer} name={name} onSelect={setSelected} botGame={game?.is_bot ? game : undefined} />;
}

export function EmojiReactionSettings({ userId }: { userId?: string }) {
  return <SocialContent key={userId ?? "guest"} userId={userId ?? "guest"} peer={null} preferencesOnly />;
}

export function LocalBotSocial({ userId, game }: { userId?: string; game: BotGame & { id: string } }) {
  return <SocialContent key={`${userId ?? "guest"}:${game.id}`} userId={userId ?? "guest"} gameId={game.id} peer={null} botGame={game} />;
}

function SocialContent({ userId, gameId, peer, name, onSelect, botGame, preferencesOnly = false }: {
  userId: string; gameId?: string; peer: string | null; name?: string; onSelect?: (id: string | null) => void;
  botGame?: BotGame; preferencesOnly?: boolean;
}) {
  const [state, setState] = useState<SocialState | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [sentAt, setSentAt] = useState(0);
  const active = useRef(false), inFlight = useRef(false);
  const pendingRequest = useRef<Promise<void> | null>(null);
  const polling = useRef(true);
  const log = useRef<HTMLDivElement>(null);
  async function request(action = "state", extra: Record<string, unknown> = {}) {
    if (userId === "guest") {
      let enabled = state?.emojis_enabled ?? true;
      try {
        if (action === "preferences") localStorage.setItem("arcade-gambit-emoji-reactions-v1", String(extra.p_enabled));
        enabled = localStorage.getItem("arcade-gambit-emoji-reactions-v1") !== "false";
      } catch { if (action === "preferences") enabled = extra.p_enabled === true; }
      if (active.current) setState({ friends: [], messages: [], reactions: [], emojis_enabled: enabled, peer_emojis_enabled: true });
      return true;
    }
    if (!supabase) return false;
    if (inFlight.current) {
      if (action === "state") return false;
      await pendingRequest.current;
      if (!active.current) return false;
      return request(action, extra);
    }
    let release!: () => void;
    pendingRequest.current = new Promise<void>(resolve => { release = resolve; });
    inFlight.current = true;
    if (action !== "state") setBusy(true);
    try {
      const { data, error: failure } = await supabase.rpc("online_social", {
        p_action: action, p_game: botGame ? null : gameId ?? null, p_peer: botGame ? null : peer, ...extra,
      });
      if (failure) throw new Error(failure.code === "PGRST202" ? "Friends and chat are not available on this server yet." : failure.message);
      polling.current = true;
      if (active.current) { setState(data as SocialState); if (action !== "state") setError(""); }
      return true;
    } catch (failure) {
      if (action === "state") polling.current = false;
      if (active.current) setError(failure instanceof Error ? failure.message : "Could not connect to friends. Please retry.");
      return false;
    } finally { inFlight.current = false; release(); if (active.current) setBusy(false); }
  }
  useEffect(() => {
    active.current = true;
    void request();
    const poll = botGame || preferencesOnly ? undefined : window.setInterval(() => { if (polling.current && !document.hidden) void request(); }, 3000);
    const tick = preferencesOnly ? undefined : window.setInterval(() => setNow(Date.now()), 500);
    return () => { active.current = false; clearInterval(poll); clearInterval(tick); };
  }, []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [state?.messages.at(-1)?.id]);
  const friend = state?.friends.find(item => item.user_id === peer);
  const peerName = name ?? friend?.name ?? "Player";
  const pending = !!friend && !friend.accepted;
  const incoming = pending && friend.requested_by !== userId;
  const disabled = busy || !state || inFlight.current;
  const emojiPanel = state && <>
      {(gameId || preferencesOnly) && <label className="social-mute"><input type="checkbox" checked={state.emojis_enabled} disabled={disabled}
        onChange={event => {
          const previous = state;
          setState({ ...state, emojis_enabled: event.target.checked, reactions: [] });
          void request("preferences", { p_enabled: event.target.checked }).then(ok => { if (!ok && active.current) setState(previous); });
        }} /> Emoji reactions enabled</label>}
      {!preferencesOnly && (botGame ? <BotBoardReactions game={botGame} enabled={state.emojis_enabled} /> : <>
        {state.emojis_enabled ? <>
          <div className="social-emojis" role="group" aria-label="Send an emoji reaction">{EMOJI_REACTIONS.map(([emoji, label]) =>
            <button key={emoji} title={label} aria-label={`Send ${label.toLowerCase()}`} disabled={disabled || !state.peer_emojis_enabled || now - sentAt < 2000}
              onClick={() => { setSentAt(Date.now()); void request("emoji", { p_body: emoji }); }}>{emoji}</button>)}</div>
          {!state.peer_emojis_enabled && <p className="review-note">Your opponent has turned off emojis.</p>}
          <div className="social-reactions" role="status" aria-live="polite">{state.reactions.filter(item => now - Date.parse(item.created_at) < 8000).map(item =>
            <span key={item.id}>{item.sender_id === userId ? "You" : peerName}: {item.body}</span>)}</div>
        </> : <p className="review-note">Emojis are hidden. Your preference is saved to your account.</p>}
      </>)}
    </>;
  const chatPanel = state && (botGame ? <BotChat name={botGame.black_name} /> : <>
      {gameId && !friend && <button disabled={disabled} onClick={() => void request("request")}>Add friend</button>}
      {!gameId && <div className="social-friends">
        {!state.friends.length && <p className="review-note">Meet players in human matches and use Add friend to stay in touch.</p>}
        {state.friends.map(item => <button key={item.user_id} aria-pressed={peer === item.user_id} onClick={() => onSelect?.(item.user_id)}>
          {item.name} · {item.accepted ? "Chat" : item.requested_by === userId ? "Request sent" : "Friend request"}
        </button>)}
      </div>}
      {pending && <div className="social-friend-actions">
        <p>{incoming ? `${peerName} wants to be your friend.` : gameId ? "Friend request sent." : "Friend request sent. Chat unlocks when they accept."}</p>
        {incoming && <button disabled={disabled} onClick={() => void request("accept")}>Accept friend request</button>}
        <button disabled={disabled} onClick={() => void request("remove")}>{incoming ? "Decline request" : "Cancel request"}</button>
      </div>}
      {gameId || friend?.accepted ? <>
        <h4>Chat with {peerName}</h4>
        <div className="social-chat-log" role="log" aria-label={`Chat with ${peerName}`} ref={log}>
          {!state.messages.length && <p>Say hello to {peerName}!</p>}
          {state.messages.map(item => <p key={item.id} className={item.sender_id === userId ? "social-message-own" : ""}>
            <strong>{item.sender_id === userId ? "You" : peerName}</strong> <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span>{item.body}</span>
          </p>)}
        </div>
        <form className="social-chat-form" onSubmit={event => {
          event.preventDefault(); const body = draft.trim();
          if (body && !disabled) void request("chat", { p_body: body }).then(ok => { if (ok && active.current) setDraft(""); });
        }}>
          <label>Message<input value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} disabled={busy} placeholder="Say hello…" autoComplete="off" /></label>
          <button disabled={disabled || !draft.trim()}>Send</button>
        </form>
        {friend?.accepted && <details><summary>Manage friendship</summary><p>Removing this friend ends private lobby chat and clears that conversation for both players. Match chat stays with its game.</p><button disabled={disabled} onClick={() => void request("remove")}>Remove friend & clear chat</button></details>}
      </> : null}
    </>);
  return <section className={preferencesOnly ? undefined : "online-social"} aria-label={preferencesOnly ? "Emoji reactions" : "Friends and chat"}>
    {preferencesOnly ? <><h2>Emoji reactions</h2><p>Show and send emoji reactions during games. This preference is saved {userId === "guest" ? "on this device" : "to your account"}.</p></> :
      <h3>{botGame ? "Practice bot reactions" : gameId ? `Connect with ${peerName}` : "Friends & chat"}</h3>}
    {error && <p className="social-error" role="alert">{error} <button disabled={busy} onClick={() => { setError(""); void request(); }}>Retry</button></p>}
    {!state && !error && <p role="status">{preferencesOnly ? "Loading preference…" : "Loading friends…"}</p>}
    {state && (preferencesOnly ? emojiPanel : gameId ? <CommunicationTabs chat={chatPanel} emojis={emojiPanel} /> : chatPanel)}
  </section>;
}
