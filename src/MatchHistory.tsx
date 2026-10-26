import type { CSSProperties } from "react";
import { Star } from "lucide-react";
import { Chess } from "./chess";
import type { ArchivedMatch } from "./matchArchive";
import { bossPortrait, resolveBossCharacter } from "./bossArtwork";
import { bossRematchPlea } from "./bossRematches";
import { bossVictoryTaunt } from "./bossVictoryTaunts";
const labels = { win: "Victory", loss: "Defeat", draw: "Draw", unfinished: "Unfinished" };
function movesFor(match: ArchivedMatch) { const game = new Chess(); game.loadPgn(match.pgn); return game.history({ verbose: true }); }
function styleFor(match: ArchivedMatch) { return /\[Variant\s+"Chess960"\]/i.test(match.pgn) ? "Freestyle" : "Standard"; }
export function MatchHistory({ matches, signedIn, onReview, onResume }: { matches: ArchivedMatch[]; signedIn?: boolean; onReview: (id: string) => void; onResume: (match: ArchivedMatch) => void }) {
  return <section className="game-review history-page" aria-labelledby="history-title">
    <header><h2 id="history-title">Historic games</h2><span>{matches.length} saved</span></header>
    <p className="review-note">{signedIn ? "Every move is saved to your account. Resume unfinished games or replay any match on another device." : "Every move is saved automatically in this browser. Sign in to keep your games across devices."}</p>
    {!matches.length ? <p>Your games will appear here when you start playing.</p> : <div className="history-list">{matches.map((match) =>
      <div className="history-item" key={match.id}>
        <span><strong>{match.opponent}</strong><small>{new Date(match.startedAt).toLocaleString()} ? {match.elo} ELO ? You played {match.color === "w" ? "White" : "Black"}{match.debug ? " · DEBUG TEST" : ""}</small></span>
        <span className={`match-style match-style-${styleFor(match).toLowerCase()}`}>{styleFor(match)}</span>
        <span className={`match-outcome outcome-${match.result}`}>{labels[match.result]}</span>
        <span>{movesFor(match).length} plies</span><div className="history-actions">{match.result === "unfinished" && <button onClick={() => onResume(match)}>Resume game</button>}<a href={`#review/${match.id}`} onClick={(event) => { event.preventDefault(); onReview(match.id); }}>Review &rarr;</a></div>
      </div>)}</div>}
  </section>;
}
export function MatchResult({ match, onReview, onHome }: { match: ArchivedMatch; onReview: () => void; onHome: () => void }) {
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
