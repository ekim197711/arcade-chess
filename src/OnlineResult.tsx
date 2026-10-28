import { useMemo } from "react";
import { Chess } from "./chess";
import { formatClock, type OnlineGame } from "./onlineChess";
import { reviewAccuracy } from "./reviewAccuracy";
import { useGameAnalysis } from "./useGameAnalysis";
import { FinalPositionBoard } from "./FinalPositionBoard";
import type { PieceStyle } from "./PieceArtwork";

export function OnlineResult({ game, userId, onReview, onPlayAgain, onChooseTime, onHome, theme, light, dark }: {
  game: OnlineGame; userId: string; onReview: () => void; onPlayAgain: () => void; onChooseTime: () => void; onHome: () => void;
  theme: PieceStyle; light: string; dark: string;
}) {
  const moves = useMemo(() => { const position = new Chess(); if (game.pgn) position.loadPgn(game.pgn); return position.history({ verbose: true }); }, [game.pgn]);
  const { analyses, failed } = useGameAnalysis(game.pgn);
  const side = game.black_id === userId ? "b" : "w";
  const participant = game.white_id === userId || game.black_id === userId;
  const draw = game.result === "1/2-1/2";
  const won = game.result === (side === "w" ? "1-0" : "0-1");
  const winner = game.result === "1-0" ? game.white_name : game.black_name;
  const delta = side === "w" ? game.white_delta : game.black_delta;
  return <section className="game-review online-result" data-outcome={draw ? "draw" : participant && !won ? "loss" : "win"} aria-labelledby="online-result-title">
    <p className="online-result-kicker">MATCH COMPLETE · {game.is_bot ? "BOT PRACTICE" : "HUMAN MATCH"} · {game.minutes}+0</p>
    <h1 id="online-result-title">{draw ? "Draw" : participant ? won ? "Victory" : "Defeat" : `${winner} wins`}</h1>
    <p className="online-result-winner">{draw ? `${game.white_name} and ${game.black_name} drew.` : `${winner} won ${game.result === "1-0" ? "as White" : "as Black"}.`}</p>
    <p className="result-reason">{game.result} · {game.reason}</p>
    {game.is_bot && <FinalPositionBoard pgn={game.pgn} color={side} theme={theme} light={light} dark={dark} />}
    <dl className="result-stats">
      <div><dt>White</dt><dd>{game.white_name}</dd></div><div><dt>Black</dt><dd>{game.black_name}</dd></div>
      <div><dt>Moves played</dt><dd>{moves.length} plies</dd></div><div><dt>Captures</dt><dd>{moves.filter(move => move.captured).length}</dd></div>
      <div><dt>White clock</dt><dd>{formatClock(game.white_ms)}</dd></div><div><dt>Black clock</dt><dd>{formatClock(game.black_ms)}</dd></div>
    </dl>
    <p>{game.rated && participant ? `Your Elo change: ${delta >= 0 ? "+" : ""}${delta}` : "Unrated game · Elo unchanged"}</p>
    <section className="review-accuracy" aria-labelledby="online-result-accuracy-title">
      <h2 id="online-result-accuracy-title">Game accuracy</h2>
      <div className="review-accuracy-scores">{(["w", "b"] as const).map(color => {
        const accuracy = reviewAccuracy(moves, analyses, color);
        return <div key={color}><span>{color === "w" ? game.white_name : game.black_name} · {color === "w" ? "White" : "Black"}</span>
          <strong>{accuracy.score === null ? "—" : `${accuracy.score.toFixed(1)}%`}</strong>
          <small>{!accuracy.expected ? "No moves played" : `${accuracy.analyzed} / ${accuracy.expected} moves analyzed${accuracy.analyzed < accuracy.expected ? failed ? " · Partial analysis" : " · Analyzing…" : " · Complete"}`}</small>
        </div>;
      })}</div>
      <p className="review-note">Estimated by the same short engine search used in review. Scores update as analysis completes.</p>
      {failed && <p role="status">Some analysis is unavailable. You can still review every move.</p>}
    </section>
    <div className="review-controls online-result-actions">
      <button onClick={onReview}>Review game</button><button onClick={onPlayAgain}>New {game.minutes}-minute game</button>
      <button onClick={onChooseTime}>Choose time control</button><button onClick={onHome}>Back to home</button>
    </div>
    <p className="review-note">A new game finds another human with the same clock, with unrated bot practice if nobody is available after 20 seconds.</p>
  </section>;
}
