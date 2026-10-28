import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Move, type Square } from "./chess";
import type { MoveAnalysis } from "./bot";
import { useGameAnalysis } from "./useGameAnalysis";
import { evaluatePlayerElo, evaluateReviewSkills } from "./reviewSkills";
import { reviewAdvantage, reviewEvaluationChange } from "./reviewAdvantage";
import { moveAccuracy, reviewAccuracy } from "./reviewAccuracy";
import { reviewEngineAgreement, assistanceSample, assistanceAssessment } from "./reviewAssistance";
import { normalizeMoveTimes, formatMoveTime, type MoveTimes } from "./moveTiming";
import { CheckCircle2, TriangleAlert, CircleAlert } from "lucide-react";
import { PieceArtwork, PIECE_CHOICES, loadPieceStyle, type PieceStyle } from "./PieceArtwork";
import type { PieceColor } from "./MedievalPiece";
import "./review.css";
import { BoardAnnotations } from "./BoardAnnotations";

const MOVE_SPEEDS = [0.5, 1, 1.5, 2, 3, 5, 10];
const SPECIAL_MOVE_WAITS = [0.5, 1, 1.5, 2, 2.5, 3];
const REVIEW_PREFERENCES_KEY = "arcade-chess-review-preferences-v1";
type ReviewPreferences = { moveSeconds: number; specialMoveSeconds: number; theme: PieceStyle; showCoordinates: boolean; eventMode: "pause" | "stop" | "continue" };
function readReviewPreferences(fallbackTheme: PieceStyle): ReviewPreferences {
  const defaults: ReviewPreferences = { moveSeconds: 2, specialMoveSeconds: 1.5, theme: fallbackTheme, showCoordinates: true, eventMode: "pause" };
  try {
    const saved = JSON.parse(localStorage.getItem(REVIEW_PREFERENCES_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return defaults;
    return {
      moveSeconds: typeof saved.moveSeconds === "number" && Number.isFinite(saved.moveSeconds) && saved.moveSeconds >= 0.2 && saved.moveSeconds <= 30 ? saved.moveSeconds : defaults.moveSeconds,
      specialMoveSeconds: SPECIAL_MOVE_WAITS.includes(saved.specialMoveSeconds) ? saved.specialMoveSeconds : defaults.specialMoveSeconds,
      theme: PIECE_CHOICES.some((choice) => choice.id === saved.theme) ? saved.theme : defaults.theme,
      showCoordinates: typeof saved.showCoordinates === "boolean" ? saved.showCoordinates : defaults.showCoordinates,
      eventMode: ["pause", "stop", "continue"].includes(saved.eventMode) ? saved.eventMode : defaults.eventMode,
    };
  } catch { return defaults; }
}

type Props = {
  pgn: string;
  opponent: string;
  opponentElo: number;
  opponentKind?: "human" | "bot";
  closeLabel?: string;
  playerName: string;
  theme: PieceStyle;
  color: PieceColor;
  light: string;
  dark: string;
  onClose: () => void;
  onMoveSound?: (move: Move, position: Chess) => void;
  moveTimesMs?: MoveTimes;
  timingSource?: "server" | "device";
};

export function GameReview({ pgn, opponent, opponentElo, opponentKind = "bot", closeLabel = "Back to home", playerName, theme, color, light, dark, onClose, onMoveSound, moveTimesMs, timingSource = "device" }: Props) {
  const [preferences, setPreferences] = useState(() => readReviewPreferences(theme));
  const { eventMode, moveSeconds, specialMoveSeconds, showCoordinates, theme: reviewTheme } = preferences;
  const [savingFailed, setSavingFailed] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [themeError, setThemeError] = useState("");
  function setEventMode(value: string) {
    if (value === "pause" || value === "stop" || value === "continue") {
      setPreferences((current) => ({ ...current, eventMode: value }));
    }
  }
  useEffect(() => {
    try {
      localStorage.setItem(REVIEW_PREFERENCES_KEY, JSON.stringify(preferences));
      setSavingFailed(false);
    } catch { setSavingFailed(true); }
  }, [preferences]);
  async function changeReviewTheme(value: string) {
    const choice = PIECE_CHOICES.find((item) => item.id === value);
    if (!choice || choice.id === reviewTheme) return;
    setThemeLoading(true);
    setThemeError("");
    try {
      await loadPieceStyle(choice.id);
      setPreferences((current) => ({ ...current, theme: choice.id }));
    } catch { setThemeError("Could not load that theme. Please try again."); }
    finally { setThemeLoading(false); }
  }
  const [eventNotice, setEventNotice] = useState("");
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [variation, setVariation] = useState<{ fen: string; line: string[]; step: number } | null>(null);
  const [variationPlaying, setVariationPlaying] = useState(false);
  const preview = variation !== null;
  const [explainOpen, setExplainOpen] = useState(false);
  useEffect(() => { setExplainOpen(false); }, [ply]);
  const { analyses, failed } = useGameAnalysis(pgn);
  const liveAnalysis = useRef({ analyses, failed });
  liveAnalysis.current = { analyses, failed };
  const moves = useMemo(() => {
    const game = new Chess();
    game.loadPgn(pgn);
    return game.history({ verbose: true });
  }, [pgn]);
  const timings = useMemo(() => normalizeMoveTimes(moveTimesMs, moves.length), [moveTimesMs, moves.length]);
  const samples = useMemo(() => ({ w: assistanceSample(moves, "w"), b: assistanceSample(moves, "b") }), [moves]);
  const assessments = useMemo(() => ({ w: assistanceAssessment(samples.w, analyses, timings, timingSource), b: assistanceAssessment(samples.b, analyses, timings, timingSource) }), [samples, analyses, timings, timingSource]);
  const skillRatings = useMemo(() => evaluateReviewSkills(moves, analyses, color), [moves, analyses, color]);
  const playerElo = useMemo(() => evaluatePlayerElo(moves, analyses, color), [moves, analyses, color]);
  const move = moves[ply - 1];
  const analysis = analyses[ply - 1];
  const historicPosition = useMemo(() => {
    const game = new Chess();
    game.loadPgn(pgn);
    for (let index = moves.length; index > ply; index--) game.undo();
    return game;
  }, [pgn, moves.length, ply]);
  const advantage = reviewAdvantage(historicPosition, ply === 0 ? analyses[0]?.evaluationBefore : analysis?.evaluationAfter, failed);
  const evaluationChange = ply === 0 ? null : reviewEvaluationChange(
    historicPosition.isDraw() ? 0 : analysis?.evaluationAfter,
    ply === 1 ? analyses[0]?.evaluationBefore : analyses[ply - 2]?.evaluationAfter,
  );
  const boardRating = analysis ? moveRating(analysis) : { key: "pending", label: "Analyzing move", icon: "..." };
  const position = new Chess(variation?.fen ?? move?.after ?? moves[0]?.before);
  if (!variation && !move && !moves.length) position.loadPgn(pgn);
  let last = variation ? undefined : moves[ply - 1];
  if (variation) {
    for (const san of variation.line.slice(0, variation.step)) last = position.move(san);
  }
  const rows = position.board();
  if (color === "b") { rows.reverse(); rows.forEach((row) => row.reverse()); }

  const positionFen = position.fen();
  const suggestedSan = variation ? variation.line[variation.step] : analyses[ply]?.suggested;
  const [extraSuggestion, setExtraSuggestion] = useState<{ fen: string; san: string | null } | null>(null);
  const needsExtraSuggestion = !suggestedSan && (preview || ply === moves.length) && !position.isGameOver();
  useEffect(() => {
    if (!needsExtraSuggestion) return;
    let worker: Worker | undefined;
    try {
      worker = new Worker(new URL("./reviewBestMove.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ fen: string; san: string | null }>) => {
        setExtraSuggestion(event.data);
        worker?.terminate();
      };
      worker.onerror = () => worker?.terminate();
      worker.postMessage(positionFen);
    } catch { /* Replay remains available if suggestion analysis fails. */ }
    return () => worker?.terminate();
  }, [positionFen, needsExtraSuggestion]);
  const arrow = useMemo(() => {
    const san = suggestedSan ?? (extraSuggestion?.fen === positionFen ? extraSuggestion.san : null);
    if (!san) return null;
    try {
      const current = new Chess(positionFen);
      if (current.isGameOver()) return null;
      const best = current.move(san);
      return { from: best.from, to: best.to, san: best.san, path: bestMoveArrow(best.from, best.to, color) };
    } catch { return null; }
  }, [positionFen, suggestedSan, extraSuggestion, color]);
  const previousSoundPosition = useRef(positionFen);
  useEffect(() => {
    if (previousSoundPosition.current === positionFen) return;
    previousSoundPosition.current = positionFen;
    if (last) onMoveSound?.(last, position);
  }, [positionFen, last, position, onMoveSound]);


  useEffect(() => {
    if (!playing || preview) return;
    if (ply >= moves.length) { setPlaying(false); setEventNotice(""); return; }
    const delay = (moveSeconds + (eventNotice && eventMode === "pause" ? specialMoveSeconds : 0)) * 1000;
    let timer: number;
    const advance = () => {
      const rating = liveAnalysis.current.analyses[ply];
      if (eventMode !== "continue" && !liveAnalysis.current.failed && !rating) {
        timer = window.setTimeout(advance, 100);
        return;
      }
      const next = moves[ply]!;
      const special = next.san.includes("+") || next.san.includes("#") || !!next.promotion ||
        !!next.captured || next.isKingsideCastle() || next.isQueensideCastle() ||
        !!rating && (rating.matches || rating.loss >= 50);
      setVariation(null);
      setPly(ply + 1);
      setEventNotice(special && eventMode !== "continue" ? `${next.san}: ${rating ? moveRating(rating).label : "Special move"}` : "");
      if (special && eventMode === "stop") setPlaying(false);
    };
    timer = window.setTimeout(advance, delay);
    return () => window.clearTimeout(timer);
  }, [playing, ply, moves, eventMode, eventNotice, preview, moveSeconds, specialMoveSeconds]);

  useEffect(() => {
    if (!variation || !variationPlaying) return;
    if (variation.step >= variation.line.length) { setVariationPlaying(false); return; }
    const timer = window.setTimeout(() => {
      setVariation((current) => current ? { ...current, step: current.step + 1 } : null);
    }, moveSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [variation, variationPlaying, moveSeconds]);

  function showBestLine() {
    if (!move || !analysis) return;
    setPlaying(false);
    setEventNotice("");
    setVariation({ fen: move.before, line: [...analysis.suggestedLine], step: 0 });
    setVariationPlaying(true);
  }

  function resumeReplay() {
    setVariationPlaying(false);
    setVariation(null);
    setEventNotice("");
    setPlaying(ply < moves.length);
  }

  function jump(index: number) {
    setPlaying(false);
    setEventNotice("");
    setVariation(null);
    setPly(Math.max(0, Math.min(moves.length, index)));
  }

  return (
    <section className="game-review" aria-labelledby="review-title">
      <header>
        <h2 id="review-title">Game review</h2>
        <button type="button" onClick={onClose} >{closeLabel}</button>
      </header>
      <div className="review-layout">
        <aside className="review-move-column" aria-label="All game moves">
          <h3>Moves</h3>
          <div className="review-player-headings" aria-label="Move columns">
            {(["w", "b"] as const).map((side) => <div key={side}>
              <span className="review-player-role">{side === color ? "USER" : opponentKind === "human" ? "OPPONENT" : "BOSS"} / {side === "w" ? "White" : "Black"}</span>
              <strong>{side === color ? playerName : opponent}</strong>
            </div>)}
          </div>
          <nav className="review-moves" aria-label="Review move list">
            {moves.map((item, index) => <button key={index} disabled={preview} aria-current={ply === index + 1 ? "step" : undefined} onClick={() => jump(index + 1)}>
              <span className="review-move-notation">{Math.floor(index / 2) + 1}{item.color === "w" ? "." : "..."} {item.san}</span>
              <RatingBadge analysis={analyses[index]} />
              <AccuracyBadge analysis={analyses[index]} failed={failed} />
              {timings[index] !== null && <span className="review-move-time" aria-label={`Time spent: ${formatMoveTime(timings[index])}`}>{formatMoveTime(timings[index])}</span>}
            </button>)}
          </nav>
        </aside>
        <div className="review-board-column">
          {!preview && <section className="review-advantage" aria-label="Position evaluation">
            <div className="review-advantage-heading" aria-live="polite">
              <strong>{advantage.label}</strong><span>{advantage.score}</span>
            </div>
            <div className="review-advantage-change" aria-live="polite" title="Change in estimated pawn advantage from the previous game position. Unavailable at the start, while analysis is pending, or for mate scores.">
              Change from previous: <strong>{evaluationChange ?? "—"}</strong>
            </div>
            <div className={`review-advantage-track${advantage.pending ? " review-advantage-pending" : ""}`} role="img" aria-label={`${advantage.label}, evaluation ${advantage.score}`}>
              <div className="review-advantage-white" style={{ width: `${advantage.whitePercent}%` }} />
            </div>
            <div className="review-advantage-players">
              <span>White · {color === "w" ? playerName : opponent}</span>
              <span>Black · {color === "b" ? playerName : opponent}</span>
            </div>
          </section>}
          <div className={`review-board-frame${showCoordinates ? " review-board-with-coordinates" : ""}`}>
          {showCoordinates && <div className="review-axis review-rank-axis" aria-label="Board ranks">{Array.from({ length: 8 }, (_, index) => <span key={index}>{color === "w" ? 8 - index : index + 1}</span>)}</div>}
          <div className="review-board chessboard" style={{ "--board-square-light": light, "--board-square-dark": dark } as CSSProperties} aria-label={preview ? "Best move line chessboard" : "Replay chessboard"}>
            <BoardAnnotations color={color} positionKey={positionFen} />
            {rows.flatMap((row, rowIndex) => row.map((piece, columnIndex) => {
              const file = String.fromCharCode(97 + (color === "w" ? columnIndex : 7 - columnIndex));
              const rank = color === "w" ? 8 - rowIndex : rowIndex + 1;
              const square = `${file}${rank}`;
              return <div key={square} data-square={square} className={`square square-${(rowIndex + columnIndex) % 2 ? "dark" : "light"}${last && (last.from === square || last.to === square) ? " review-highlight" : ""}`} aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""}`}>
                {piece && <span className="chess-piece"><PieceArtwork type={piece.type} color={piece.color} theme={reviewTheme} fitToSquare /></span>}
                {!preview && piece && move?.to === square && <span className={`review-piece-rating rating-${boardRating.key}`} role="img" aria-label={boardRating.label} title={boardRating.label}>{boardRating.icon}</span>}
              </div>;
            }))}
            {arrow && <svg className="review-best-arrow" viewBox="0 0 8 8" role="img" aria-label={`Best move: ${arrow.san}, ${arrow.from} to ${arrow.to}`} data-from={arrow.from} data-to={arrow.to}><path d={arrow.path} /></svg>}
          </div>
          {showCoordinates && <div className="review-axis review-file-axis" aria-label="Board files">{Array.from({ length: 8 }, (_, index) => <span key={index}>{String.fromCharCode(97 + (color === "w" ? index : 7 - index))}</span>)}</div>}
          </div>
          {!preview && <>
          <div className="review-controls">
            <button onClick={() => jump(0)} disabled={ply === 0}>Start</button>
            <button onClick={() => jump(ply - 1)} disabled={ply === 0}>Previous</button>
            <button onClick={() => { setEventNotice(""); setVariation(null); if (ply === moves.length) setPly(0); setPlaying(!playing); }} disabled={!moves.length}>{playing ? "Pause" : "Play"}</button>
            <button onClick={() => jump(ply + 1)} disabled={ply === moves.length}>Next</button>
            <button onClick={() => jump(moves.length)} disabled={ply === moves.length}>End</button>
          </div>
          </>}
          <p role="status">{eventNotice ? `${eventNotice} - ${eventMode === "stop" ? "Stopped. Press Play to continue." : `Waiting ${specialMoveSeconds.toFixed(1)} extra seconds.`}` : playing && !analyses[ply] && !failed && eventMode !== "continue" ? "Waiting for move analysis..." : ""}</p>
          <label className="review-scrubber">Position {ply} / {moves.length}
            <input aria-label="Replay position" disabled={preview} type="range" min="0" max={moves.length} value={ply} onChange={(event) => jump(Number(event.target.value))} />
          </label>
        </div>
        <aside className="review-details">
          <p role="status">{failed ? "Analysis unavailable. Replay is still available." : `Analyzed ${Object.keys(analyses).length} of ${moves.length} moves`}</p>
          <section className="review-suggestion" aria-live="polite">
            <h3>{move ? `${Math.floor((ply - 1) / 2) + 1}${move.color === "w" ? "." : "..."} ${move.san}` : "Starting position"}</h3>
            <p>{move ? preview ? "Suggested alternative shown on the board." : `${move.color === "w" ? "White" : "Black"} played ${move.san}.` : moves.length ? "Choose Play or Next to start the replay." : "No moves were played in this game."}</p>
            {move && <RatingBadge analysis={analysis} />}
            {move && <p className="review-selected-accuracy">Move accuracy: <AccuracyBadge analysis={analysis} failed={failed} /></p>}
            {move && <p className="review-note">Time spent on this move: <strong>{formatMoveTime(timings[ply - 1])}</strong></p>}
            <div className="review-move-actions">
              <button className="review-explain-toggle" type="button" disabled={!move || !analysis} aria-expanded={explainOpen} aria-controls="review-move-explanation" onClick={() => {
                setPlaying(false);
                setEventNotice("");
                setExplainOpen(!explainOpen);
              }}>{explainOpen ? "Hide explanation" : "Explain"}</button>
              <button type="button" disabled={!move || !analysis} onClick={showBestLine}>Best move</button>
            </div>
            {move && !analysis && <p>{failed ? "No suggestion available." : "Analyzing this position..."}</p>}
            {explainOpen && analysis && <div id="review-move-explanation">
              <p className="review-explanation">{analysis.explanation}</p>
              <div className="review-lines">
                <p><strong>Played line:</strong> {analysis.playedLine.join(" / ")}</p>
                {!analysis.matches && <p><strong>Better line:</strong> {analysis.suggestedLine.join(" / ")}</p>}
                <small>Each line shows the move and the strongest immediate reply found. Deeper tactics may change the assessment.</small>
              </div>
            </div>}
          </section>

          {variation && <section className="review-variation" aria-label="Best move line">
            <strong>Best move line</strong>
            <ol>{variation.line.map((san, index) => <li key={index}>
              <button type="button" aria-current={variation.step === index + 1 ? "step" : undefined} aria-label={`Show position after ${san}`} onClick={() => {
                setVariationPlaying(false);
                setVariation({ ...variation, step: index + 1 });
              }}>{san}</button>
            </li>)}</ol>
            <p role="status">{variation.step === variation.line.length ? "Line complete" : `Step ${variation.step} / ${variation.line.length}`} / Game paused at position {ply}</p>
            <div className="review-controls">
              <button onClick={() => { setVariationPlaying(false); setVariation({ ...variation, step: Math.max(0, variation.step - 1) }); }} disabled={variation.step === 0}>Previous</button>
              <button onClick={() => { if (variation.step === variation.line.length) setVariation({ ...variation, step: 0 }); setVariationPlaying(!variationPlaying); }}>{variationPlaying ? "Pause line" : variation.step === variation.line.length ? "Replay line" : "Play line"}</button>
              <button onClick={() => { setVariationPlaying(false); setVariation({ ...variation, step: variation.step + 1 }); }} disabled={variation.step === variation.line.length}>Next</button>
              <button className="review-resume" onClick={resumeReplay}>Resume</button>
            </div>
          </section>}

          <div className="review-settings-bottom">
          <div className="review-appearance" role="group" aria-label="Review settings">
            <label>Review piece theme
              <select value={reviewTheme} disabled={themeLoading} onChange={(event) => void changeReviewTheme(event.target.value)}>
                {PIECE_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
              </select>
            </label>
            <label className="review-coordinate-toggle"><input type="checkbox" checked={showCoordinates} onChange={(event) => setPreferences((current) => ({ ...current, showCoordinates: event.target.checked }))} /> Show board coordinates</label>
          <label className="review-speed-setting">Seconds per move
            <select value={moveSeconds} onChange={(event) => {
              const seconds = Number(event.target.value);
              setPreferences((current) => ({ ...current, moveSeconds: seconds }));
            }} aria-describedby="review-speed-note">
              {!MOVE_SPEEDS.includes(moveSeconds) && <option value={moveSeconds}>{moveSeconds} seconds (saved)</option>}
              {MOVE_SPEEDS.map((seconds) => <option key={seconds} value={seconds}>{seconds} {seconds === 1 ? "second" : "seconds"}</option>)}
            </select>
          </label>
          <p id="review-speed-note" className="review-note">Applies to replay and best-move lines.</p>
          <label className="review-event-setting">On special moves
            <select value={eventMode} onChange={(event) => { setEventMode(event.target.value); setEventNotice(""); }}>
              <option value="continue">Keep playing</option><option value="pause">Wait extra time</option><option value="stop">Stop until I press Play</option>
            </select>
          </label>
          {eventMode === "pause" && <label className="review-event-setting">Extra wait on special moves
            <select value={specialMoveSeconds} aria-describedby="review-special-wait-note" onChange={(event) => {
              const seconds = Number(event.target.value);
              if (SPECIAL_MOVE_WAITS.includes(seconds)) setPreferences((current) => ({ ...current, specialMoveSeconds: seconds }));
            }}>
              {SPECIAL_MOVE_WAITS.map((seconds) => <option key={seconds} value={seconds}>{seconds.toFixed(1)} seconds</option>)}
            </select>
          </label>}
          {eventMode === "pause" && <p id="review-special-wait-note" className="review-note">Adds {specialMoveSeconds.toFixed(1)} seconds to the normal move delay.</p>}
          <p className="review-note">Special moves: best moves, inaccuracies or worse, captures, checks, castling and promotions.</p>
          </div>
          {themeLoading && <p role="status">Loading review theme...</p>}
          {themeError && <p role="alert">{themeError}</p>}
          {savingFailed && <p role="alert">Review preferences could not be saved in this browser. Your choices still apply while this page is open.</p>}
          </div>

        </aside>
      </div>
      <div className="rating-legend">{RATINGS.map((rating) => <span key={rating.label} className={`move-rating rating-${rating.key}`}><b aria-hidden="true">{rating.icon}</b> {rating.label}</span>)}</div>
      <section className="review-accuracy" aria-labelledby="review-accuracy-title">
        <h3 id="review-accuracy-title">Game accuracy</h3>
        <div className="review-accuracy-scores">
          {([color, color === "w" ? "b" : "w"] as const).map((side) => {
            const accuracy = reviewAccuracy(moves, analyses, side);
            return <div key={side}>
              <span>{side === color ? playerName : opponent} / {side === "w" ? "White" : "Black"}</span>
              <strong>{accuracy.score === null ? "—" : `${accuracy.score.toFixed(1)}%`}</strong>
              <small>{accuracy.expected === 0 ? "No moves played" : `${accuracy.analyzed} / ${accuracy.expected} moves analyzed${accuracy.analyzed < accuracy.expected ? failed ? " · Partial analysis" : " · Updating" : " · Complete"}`}</small>
            </div>;
          })}
        </div>
        <p className="review-note">Estimated from this review engine's move-evaluation loss. Overall accuracy is the average of each side's analyzed move scores.</p>
        <details className="review-skill-method">
          <summary>How accuracy is calculated</summary>
          <p>A best-scoring move earns 100%. Each pawn of evaluation loss halves the score: 0.5 pawns gives 70.7%, 1 pawn gives 50%, and 2 pawns gives 25%. Scores use the short review search and may change with deeper analysis.</p>
        </details>
      </section>
      <section className="review-assistance" aria-labelledby="review-assistance-title">
        <h3 id="review-assistance-title">Assistance assessment</h3>
        <div className="review-assistance-grid">
          {([color, color === "w" ? "b" : "w"] as const).map((side) => {
            const agreement = reviewEngineAgreement(moves, analyses, side);
            const isPlayer = side === color;
            const isHuman = isPlayer || opponentKind === "human";
            const assessment = assessments[side];
            const tone = !isHuman || assessment.level === "strong" ? "red" : assessment.level === "elevated" ? "yellow" : assessment.level === "insufficient" ? "neutral" : "green";
            const Icon = tone === "green" ? CheckCircle2 : tone === "yellow" ? TriangleAlert : CircleAlert;
            const sideTimes = timings.filter((time, index): time is number => time !== null && moves[index].color === side).sort((a, b) => a - b);
            const medianTime = sideTimes.length ? (sideTimes[Math.floor((sideTimes.length - 1) / 2)] + sideTimes[Math.floor(sideTimes.length / 2)]) / 2 : null;
            return <article key={side} aria-label={`${isPlayer ? "Player" : opponentKind === "human" ? "Opponent" : "Bot"} assistance assessment`}>
              <h4>{isPlayer ? playerName : opponent} / {side === "w" ? "White" : "Black"}</h4>
              <p className={`review-assistance-verdict assistance-${tone}`}><Icon size={22} aria-hidden="true" />{isHuman ? assessment.label : "Known automated opponent"}</p>
              <p className="review-note">{isHuman ? assessment.level === "insufficient" ? "At least 12 analyzed positions after the opening are needed. Forced play, checks and reduced endgames are excluded." : "Heuristic pattern assessment, not a cheating verdict or a probability. A green check means few indicators, not proof of unassisted play." : "This is the built-in bot, so automated play is expected."}</p>
              {isHuman && assessment.signals.length > 0 && <ul className="review-assistance-signals">{assessment.signals.map(signal => <li key={signal}>{signal}</li>)}</ul>}
              <dl>
                <div><dt>Review engine agreement</dt><dd>{agreement.agreement === null ? "—" : `${agreement.agreement.toFixed(1)}%`}</dd></div>
                <div><dt>Best-scoring moves</dt><dd>{agreement.matches} / {agreement.analyzed}</dd></div>
                <div><dt>Longest matching run</dt><dd>{agreement.analyzed ? `${agreement.longestStreak} moves` : "—"}</dd></div>
                <div><dt>Positions used in assessment</dt><dd>{assessment.considered} / {assessment.available}</dd></div>
                <div><dt>Move times recorded</dt><dd>{sideTimes.length} / {agreement.expected}</dd></div>
                <div><dt>Median turn time</dt><dd>{formatMoveTime(medianTime)}</dd></div>
              </dl>
              <p className="review-note">{sideTimes.length ? timingSource === "server" ? "Times recorded by the game server. They include network delay and reconnect waits." : "Times recorded on this device. Pauses and reloads can affect them; they are not independently verified." : "Move timing was not recorded for this game. Missing times are not estimated."}</p>
              <small>{agreement.expected === 0 ? "No moves played" : `${agreement.analyzed} / ${agreement.expected} moves analyzed${agreement.analyzed < agreement.expected ? failed ? " · Partial analysis" : " · Updating" : " · Complete"}`}</small>
            </article>;
          })}
        </div>
        <details className="review-skill-method">
          <summary>What this assessment can tell you</summary>
          <p>Agreement counts moves tied for the best score in the short review search. Runs count consecutive analyzed turns for that side; missing analysis breaks a run. Opening knowledge, forced moves and straightforward positions can all produce high agreement. A low score also cannot rule out occasional help.</p>
          <p>The four indicator levels combine agreement, average evaluation loss and matching runs in eligible positions. Consistent turn times may strengthen a pattern only with at least 12 measured moves, excluding sub-0.5-second premoves and interruptions over two minutes. Strong indicators require at least 25 analyzed positions and 20 server-timed moves. Device timings cannot produce the strongest level.</p>
          <p>These rules are not calibrated against assisted and unassisted players. The short engine search, limited sample and absence of cross-game context prevent reliable claims of certainty. Missing timing or analysis is shown explicitly.</p>
          <p><a href="https://support.chess.com/en/articles/8568369-what-do-i-need-to-know-about-fair-play-on-chess-com" target="_blank" rel="noreferrer">Why accuracy and fair-play detection are different</a></p>
        </details>
      </section>
      <section className="review-skills" aria-labelledby="review-skills-title">
        <div className="review-elo-scores" aria-label="Player Elo scores">
          <div><span>{playerName} · ESTIMATE</span><strong>{playerElo === null ? "—" : `~${playerElo}`}</strong><small>{playerElo === null ? "Three analyzed moves needed" : "Estimated from this game"}</small></div>
          <div><span>{opponent} · {opponentKind === "human" ? "ONLINE ELO" : "LADDER RATING"}</span><strong>{opponentElo}</strong><small>{opponentKind === "human" ? "Online rating at game start" : "Progression rating"}</small></div>
        </div>
        <h3 id="review-skills-title">Your estimated Elo by skill</h3>
        <p className="review-note">{playerName} · {color === "w" ? "White" : "Black"} · {failed ? "Partial analysis" : Object.keys(analyses).length < moves.length ? "Updating as moves are analyzed" : "Game analysis complete"}</p>
        <dl className="review-skill-grid">
          {skillRatings.map((skill) => <div key={skill.name}>
            <dt>{skill.name}</dt>
            <dd>{skill.elo === null ? <span className="review-skill-empty">Not enough moves</span> : <><strong>~{skill.elo}</strong> <span>Elo</span></>}</dd>
            <small>{skill.moves} analyzed {skill.moves === 1 ? "move" : "moves"}{skill.moves < 3 ? " · 3 needed" : ""}</small>
          </div>)}
        </dl>
        <details className="review-skill-method">
          <summary>How these estimates work</summary>
          <p>Rough single-game estimates from average move-evaluation loss, not official or calibrated Elo ratings. Opening covers the first 10 moves per side; Endgame covers positions with at most 13 points of combined non-pawn, non-king material. Tactics covers captures, checks, promotions and forcing analyzed lines, including missed opportunities. Strategy covers quiet moves between opening and endgame. Tactical moves can also count toward a game phase.</p>
          <p>At least 3 analyzed moves are needed per skill; small samples are less reliable. Lower average loss produces a higher estimate on a 400–2400 scale, rounded to 50 Elo. The review engine has limited depth, so deeper tactics may change the assessment.</p>
        </details>
      </section>
    </section>
  );
}

function bestMoveArrow(from: Square, to: Square, color: PieceColor) {
  const center = (square: Square) => {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return { x: (color === "w" ? file : 7 - file) + 0.5, y: (color === "w" ? 7 - rank : rank) + 0.5 };
  };
  const start = center(from), end = center(to);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const dx = (end.x - start.x) / length, dy = (end.y - start.y) / length;
  const neck = { x: end.x - dx * 0.48, y: end.y - dy * 0.48 };
  const offset = (point: { x: number; y: number }, width: number) => `${point.x - dy * width},${point.y + dx * width}`;
  return `M ${offset(start, 0.11)} L ${offset(neck, 0.11)} L ${offset(neck, 0.32)} L ${end.x},${end.y} L ${offset(neck, -0.32)} L ${offset(neck, -0.11)} L ${offset(start, -0.11)} Z`;
}

const RATINGS = [
  { key: "best", label: "Best", icon: "\u2605" },
  { key: "good", label: "Good", icon: "\u2713" },
  { key: "inaccuracy", label: "Inaccuracy", icon: "?!" },
  { key: "bad", label: "Bad", icon: "?" },
  { key: "worst", label: "Worst", icon: "\u2193" },
  { key: "blunder", label: "Blunder", icon: "??" },
];
export function moveRating(analysis: MoveAnalysis) {
  return RATINGS[analysis.matches ? 0 : analysis.loss >= 200 ? 5 : analysis.worst ? 4 : analysis.loss >= 100 ? 3 : analysis.loss >= 50 ? 2 : 1]!;
}
function RatingBadge({ analysis }: { analysis?: MoveAnalysis }) {
  const rating = analysis ? moveRating(analysis) : { key: "pending", label: "Pending", icon: "..." };
  return <span className={`move-rating rating-${rating.key}`} title={analysis ? `Estimated loss: ${(analysis.loss / 100).toFixed(2)} pawns${analysis.worst ? "; lowest-scoring legal move" : ""}` : "Waiting for analysis"}><b aria-hidden="true">{rating.icon}</b> {rating.label}</span>;
}

function AccuracyBadge({ analysis, failed }: { analysis?: MoveAnalysis; failed: boolean }) {
  const accuracy = moveAccuracy(analysis);
  const label = accuracy === null ? failed ? "Accuracy unavailable" : "Accuracy pending" : `${accuracy.toFixed(1)}% accuracy`;
  return <span className="review-move-accuracy" aria-label={label} title={label}>{accuracy === null ? "—" : `${accuracy.toFixed(1)}%`}</span>;
}
