import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "./supabase";
import { readHomeOnce } from "./homeDataCache";
import type { OnlineGame } from "./onlineChess";
import { Star } from "lucide-react";
import { Chess } from "./chess";
import type { ArchivedMatch } from "./matchArchive";
import { bossPortrait, resolveBossCharacter } from "./bossArtwork";
import { bossRematchPlea } from "./bossRematches";
import { bossVictoryTaunt } from "./bossVictoryTaunts";
import { FinalPositionBoard } from "./FinalPositionBoard";
import type { PieceStyle } from "./PieceArtwork";
const labels = { win: "Victory", loss: "Defeat", draw: "Draw", unfinished: "Unfinished" };
function movesFor(match: ArchivedMatch) { const game = new Chess(); game.loadPgn(match.pgn); return game.history({ verbose: true }); }
function styleFor(match: ArchivedMatch) { return /\[Variant\s+"Chess960"\]/i.test(match.pgn) ? "Freestyle" : "Standard"; }
type GameType = "standard" | "freestyle" | "human" | "practice";
type OnlineHistoryGame = Pick<OnlineGame, "id" | "white_id" | "black_id" | "white_name" | "black_name" | "white_rating" | "black_rating" | "is_bot" | "created_at" | "result" | "ply_count" | "minutes" | "rated">;
const typeLabels: Record<GameType, string> = { standard: "Standard", freestyle: "Freestyle", human: "Human", practice: "Bot practice" };
type HistoryEntry = {
  id: string; type: GameType; startedAt: string; opponent: string; elo: number;
  color: "w" | "b"; result: keyof typeof labels; plies?: number;
  archived?: ArchivedMatch; online?: OnlineHistoryGame;
};

export function MatchHistory({ matches, userId, onReview, onResume, onOnline, refreshToken = 0, onRefresh, refreshing = false }: {
  matches: ArchivedMatch[]; userId?: string; onReview: (id: string) => void;
  onResume: (match: ArchivedMatch) => void; onOnline: (route: string) => void;
  refreshToken?: number; onRefresh?: () => void; refreshing?: boolean;
}) {
  const [filter, setFilter] = useState<"all" | GameType>("all");
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [online, setOnline] = useState<OnlineHistoryGame[]>([]);
  const [onlineError, setOnlineError] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageOffset = useRef(0), generation = useRef(0);
  async function loadOnline(reset: boolean) {
    if (!userId || !supabase) return;
    const client = supabase;
    const request = reset ? ++generation.current : generation.current;
    const offset = reset ? 0 : pageOffset.current;
    setOnlineLoading(true);
    try {
      const { data, error } = await readHomeOnce(userId, `online-history:${offset}`, () => client.from("online_games")
        .select("id,white_id,black_id,white_name,black_name,white_rating,black_rating,is_bot,created_at,result,ply_count,minutes,rated")
        .or(`white_id.eq.${userId},black_id.eq.${userId}`)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 49));
      if (request !== generation.current) return;
      if (error) throw error;
      setOnline(previous => reset ? data : [...new Map([...previous, ...data].map(game => [game.id, game])).values()]);
      pageOffset.current = offset + data.length;
      setHasMore(data.length === 50);
      setOnlineError(false);
    } catch { if (request === generation.current) setOnlineError(true); }
    finally { if (request === generation.current) setOnlineLoading(false); }
  }
  useEffect(() => {
    void loadOnline(true);
    return () => { generation.current++; };
  }, [userId, refreshToken]);
  const entries = useMemo(() => {
    const local: HistoryEntry[] = matches.map(match => ({
      id: `boss:${match.id}`, type: styleFor(match) === "Freestyle" ? "freestyle" : "standard",
      startedAt: match.startedAt, opponent: match.opponent, elo: match.elo, color: match.color,
      result: match.result, archived: match,
    }));
    const remote: HistoryEntry[] = online.map(game => {
      const color = game.white_id === userId ? "w" : "b";
      return {
        id: `online:${game.id}`, type: game.is_bot ? "practice" : "human",
        startedAt: game.created_at, opponent: color === "w" ? game.black_name : game.white_name,
        elo: color === "w" ? game.black_rating : game.white_rating, color,
        result: !game.result ? "unfinished" : game.result === "1/2-1/2" ? "draw" : game.result === (color === "w" ? "1-0" : "0-1") ? "win" : "loss",
        plies: game.ply_count, online: game,
      };
    });
    return [...local, ...remote].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  }, [matches, online, userId]);
  const visible = entries.filter(entry => filter === "all" || entry.type === filter);
  return <section className="game-review history-page" aria-labelledby="history-title">
    <header><h2 id="history-title">Historic games</h2>
      <div className="history-toolbar">
        <label className="history-filter">Game type
          <select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setVisibleLimit(50); }}>
            <option value="all">All types</option>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {userId && onRefresh && <button type="button" disabled={refreshing || onlineLoading} onClick={onRefresh}>{refreshing ? "Refreshing..." : "Refresh saved data"}</button>}
        <span>{filter === "all" ? `${entries.length} saved` : `${visible.length} of ${entries.length} saved`}</span>
      </div>
    </header>
    <p className="review-note">{userId ? "Your boss, human and practice games in one place. Resume unfinished games or replay any match on another device." : "Every move is saved automatically in this browser. Sign in to keep your games across devices and play humans."}</p>
    {onlineError && <p className="review-note" role="status">Online game history is unavailable. Use Refresh saved data to retry.</p>}
    {!visible.length ? <p>{filter === "all" ? "Your games will appear here when you start playing." : "No games of this type yet."}</p> : <div className="history-list">{visible.slice(0, visibleLimit).map(entry =>
      <div className={`history-item history-type-${entry.type}`} key={entry.id}>
        <span><strong>{entry.opponent}</strong><small>{new Date(entry.startedAt).toLocaleString()} &middot; {entry.elo} ELO &middot; You played {entry.color === "w" ? "White" : "Black"}{entry.archived?.debug ? " \u00b7 DEBUG TEST" : ""}{entry.online ? ` \u00b7 ${entry.online.minutes}+0 \u00b7 ${entry.online.rated ? "Rated" : "Unrated"}` : ""}</small></span>
        <span className={`match-style match-style-${entry.type}`}>{typeLabels[entry.type]}</span>
        <span className={`match-outcome outcome-${entry.result}`}>{labels[entry.result]}</span>
        <span>{entry.plies ?? movesFor(entry.archived!).length} plies</span>
        <div className="history-actions">
          {entry.result === "unfinished" && <button onClick={() => entry.online ? onOnline(`online/${entry.online.id}`) : onResume(entry.archived!)}>Resume game</button>}
          <a href={entry.online ? `#online/review/${entry.online.id}` : `#review/${entry.archived!.id}`} onClick={event => {
            event.preventDefault();
            if (entry.online) onOnline(`online/review/${entry.online.id}`);
            else onReview(entry.archived!.id);
          }}>Review &rarr;</a>
        </div>
      </div>)}</div>}
    {visible.length > visibleLimit && <button type="button" onClick={() => setVisibleLimit(limit => limit + 50)}>Show more saved games</button>}
    {hasMore && <button type="button" disabled={onlineLoading || refreshing} onClick={() => void loadOnline(false)}>{onlineLoading ? "Loading..." : "Load older online games"}</button>}
  </section>;
}
export function MatchResult({ match, onReview, onHome, theme, light, dark }: { match: ArchivedMatch; onReview: () => void; onHome: () => void; theme: PieceStyle; light: string; dark: string }) {
  const moves = movesFor(match);
  const character = resolveBossCharacter(match.opponent, __BOSS_PORTRAITS__);
  const angryPortrait = character && __BOSS_PORTRAITS__[character]?.includes("angry")
    ? bossPortrait(character, __BOSS_PORTRAITS__, "angry") : undefined;
  const happyPortrait = bossPortrait(character, __BOSS_PORTRAITS__, "won");
  return <section className="game-review match-result" aria-labelledby="result-title">
    <div key={match.id} className="result-confetti" aria-hidden="true">
      {Array.from({ length: 64 }, (_, index) => <i key={index} style={{
        left: `${(index * 37) % 100}%`,
        backgroundColor: ["#ffe34d", "#ff779d", "#67e8f9", "#a78bfa", "#8df5b4"][index % 5],
        animationDelay: `${(index % 11) * 0.075}s`,
        animationDuration: `${2.6 + (index % 7) * 0.18}s`,
        "--confetti-drift": `${((index * 29) % 180) - 90}px`,
        "--confetti-spin": `${index % 2 ? 720 : -540}deg`,
      } as CSSProperties} />)}
    </div>
    <Star className="result-celebration-star" fill="currentColor" strokeWidth={1.2} aria-hidden="true" />
    <p className="review-note">{match.debug ? "DEBUG MATCH COMPLETE · TEST RESULT" : "MATCH COMPLETE"}</p>
    <h1 id="result-title">{labels[match.result]}</h1>
    <p>You vs. <strong>{match.opponent}</strong> ? {match.elo} ELO</p>
    <p className="result-reason">{match.reason}</p>
    {match.result === "win" && <section className="result-rematch" aria-label={`${match.opponent} wants a rematch`}>
      {angryPortrait ? <img className="result-boss-angry" src={angryPortrait} alt={`${match.opponent} looking angry`} />
        : <span className="result-boss-angry result-boss-fallback" role="img" aria-label={`${match.opponent} looking angry`}>{"\uD83D\uDE21"}</span>}
      <div className="result-rematch-speech">
        <strong>{match.opponent}</strong>
        <blockquote>{bossRematchPlea(match.opponent)}</blockquote>
      </div>
    </section>}
    {match.result === "loss" && <section className="result-taunt" aria-label={`${match.opponent} celebrates victory`}>
      {happyPortrait && <img className="result-boss-happy" src={happyPortrait} alt={`${match.opponent} celebrating victory`} />}
      <div className="result-rematch-speech">
        <strong>{match.opponent}</strong>
        <blockquote>{bossVictoryTaunt(match.opponent)}</blockquote>
      </div>
    </section>}
    <FinalPositionBoard key={match.id} pgn={match.pgn} color={match.color} theme={theme} light={light} dark={dark} />
    <dl className="result-stats">
      <div><dt>Your pieces</dt><dd>{match.color === "w" ? "White" : "Black"}</dd></div>
      <div><dt>Moves played</dt><dd>{moves.length} plies</dd></div>
      <div><dt>Captures</dt><dd>{moves.filter((move) => move.captured).length}</dd></div>
      <div><dt>Final move</dt><dd>{moves.at(-1)?.san ?? "None"}</dd></div>
    </dl>
    <p className="review-note">{new Date(match.startedAt).toLocaleString()} ? Replay every move and explore the suggested alternatives.</p>
    <div className="review-controls"><button onClick={onReview}>Analyze & replay</button><button onClick={onHome}>Back to home</button></div>
  </section>;
}
