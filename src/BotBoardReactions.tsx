import { useEffect, useRef, useState } from "react";
import type { OnlineGame } from "./onlineChess";
import { fallbackBotReaction, type BotReaction } from "./fallbackBotReactions";
import { EMOJI_REACTIONS } from "./emojiReactions";

export function BotBoardReactions({ game, enabled }: { game: OnlineGame; enabled: boolean }) {
  const previousPly = useRef(game.ply_count);
  const lastReactionAt = useRef(-Infinity);
  const lastResult = useRef<string | null>(null);
  const [reaction, setReaction] = useState<BotReaction | null>(null);
  const [userReaction, setUserReaction] = useState<{ emoji: string } | null>(null);
  const [coolingDown, setCoolingDown] = useState(false);
  useEffect(() => { if (!enabled) setUserReaction(null); }, [enabled]);
  useEffect(() => {
    if (!userReaction) { setCoolingDown(false); return; }
    const cooldown = window.setTimeout(() => setCoolingDown(false), 2000);
    const expiry = window.setTimeout(() => setUserReaction(null), 6000);
    return () => { clearTimeout(cooldown); clearTimeout(expiry); };
  }, [userReaction]);
  useEffect(() => {
    const next = fallbackBotReaction(game, previousPly.current);
    previousPly.current = game.ply_count;
    if (!enabled) { setReaction(null); return; }
    if (!next || (next.terminal && lastResult.current === game.result)) return;
    // Allow a result to take priority; otherwise react at most once per 8 seconds.
    if (!next.terminal && Date.now() - lastReactionAt.current < 8000) return;
    if (next.terminal) lastResult.current = game.result;
    lastReactionAt.current = Date.now();
    setReaction(next);
  }, [game.pgn, game.ply_count, game.result, enabled]);
  useEffect(() => {
    if (!reaction) return;
    const timer = window.setTimeout(() => setReaction(null), 6000);
    return () => clearTimeout(timer);
  }, [reaction]);
  return <>
    {enabled && <>
      <div className="social-emojis" role="group" aria-label="Send an emoji reaction">{EMOJI_REACTIONS.map(([emoji, label]) =>
        <button key={emoji} title={label} aria-label={`Send ${label.toLowerCase()}`} disabled={coolingDown}
          onClick={() => {
            if (coolingDown) return;
            setCoolingDown(true); setUserReaction({ emoji });
          }}>{emoji}</button>)}</div>
      <div className="social-reactions" role="status" aria-live="polite" aria-label="Your reaction">
        {userReaction && <span>You: {userReaction.emoji}</span>}
      </div>
    </>}
    <p className="review-note">{enabled ? "The practice bot reacts to captures, checks, castling, promotions and the result." : "Bot emojis are hidden. Your preference is saved to your account."}</p>
    <div className="social-reactions social-bot-reaction" role="status" aria-live="polite" aria-label="Bot reaction">
      {enabled && reaction && <span><strong>{game.black_name}</strong>: <span className="social-bot-emoji">{reaction.emoji}</span> {reaction.message}</span>}
    </div>
  </>;
}
