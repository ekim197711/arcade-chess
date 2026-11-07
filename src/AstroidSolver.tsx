import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "./chess";
import { BoardSquare, BoardPanel } from "./BoardShared";
import { PromotionMenu, type PromotionPiece } from "./PromotionMenu";
import { GameStartButton } from "./GameStartButton";
import type { PieceStyle } from "./PieceArtwork";
import { AstroidArtwork, AstroidScene } from "./AstroidArtwork";
import { ASTROID_BOSSES, TRAP_SECONDS, astroidStorageKey, normalizeAstroidClears, startAstroidRun, attemptAstroidMove, expireAstroidRun, nextAstroidTrap, trapFor, type AstroidRun } from "./astroidRules";
import "./astroidSolver.css";

function TrapTimer({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - performance.now()));
  const expire = useRef(onExpire); expire.current = onExpire;
  useEffect(() => {
    let finished = false;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now());
      setRemaining(left);
      if (!left && !finished) { finished = true; expire.current(); }
    };
    tick(); const timer = window.setInterval(tick, 50);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [deadline]);
  return <div className={`astroid-timer${remaining < 3000 ? " astroid-timer-danger" : ""}`}><div><span>IMPACT IN</span><strong role="timer" aria-live="off" aria-label="Time remaining">{(remaining / 1000).toFixed(1)}<small>s</small></strong></div><progress max={TRAP_SECONDS * 1000} value={remaining} aria-label="Time until impact" /></div>;
}

export default function AstroidSolver({ accountId, theme, light, dark, onClose, onOutcome }: {
  accountId: string; theme: PieceStyle; light: string; dark: string; onClose: () => void; onOutcome: (won: boolean) => void;
}) {
  const [cleared, setCleared] = useState(() => { try { return normalizeAstroidClears(JSON.parse(localStorage.getItem(astroidStorageKey(accountId)) ?? "0")); } catch { return 0; } });
  const clearedRef = useRef(cleared);
  const [run, setRun] = useState<AstroidRun | null>(null);
  const current = useRef(run);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; x: number; y: number } | null>(null);
  const [effectReady, setEffectReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const result = useRef<HTMLDivElement>(null);
  const board = useMemo(() => run ? new Chess(run.fen) : null, [run?.fen]);
  const trap = run ? trapFor(run) : null;
  const boss = run ? ASTROID_BOSSES[run.boss] : null;
  const playing = run?.phase === "playing";
  const won = run?.phase === "solved" || run?.phase === "complete";

  function commit(next: AstroidRun | null) {
    const previous = current.current;
    current.current = next; setRun(next); setSelected(null); setPromotion(null);
    if (next && next !== previous && next.phase !== "playing" && previous?.phase === "playing") {
      onOutcome(next.phase !== "lost");
      if (next.phase === "complete") {
        const count = Math.max(clearedRef.current, next.boss + 1);
        clearedRef.current = count; setCleared(count);
        try { localStorage.setItem(astroidStorageKey(accountId), JSON.stringify(count)); setStorageError(false); }
        catch { setStorageError(true); }
      }
    }
  }
  useEffect(() => {
    setEffectReady(false);
    if (!run || run.phase === "playing") return;
    result.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setEffectReady(true), 1200);
    return () => clearTimeout(timer);
  }, [run]);
  function launch(index: number) {
    if (index > clearedRef.current) return;
    commit(startAstroidRun(index, clearedRef.current, performance.now()));
  }
  function move(from: Square, to: Square, point: { x: number; y: number }, choice?: PromotionPiece) {
    const active = current.current;
    if (!active || active.phase !== "playing") return;
    const expired = expireAstroidRun(active, performance.now());
    if (expired !== active) { commit(expired); return; }
    const position = new Chess(active.fen);
    const candidates = position.moves({ verbose: true }).filter(candidate => candidate.from === from && candidate.to === to);
    if (!candidates.length) { setSelected(null); return; }
    if (candidates.some(candidate => candidate.promotion) && !choice) { setPromotion({ from, to, ...point }); return; }
    commit(attemptAstroidMove(active, { from, to, promotion: choice }, performance.now()));
  }
  const files = trap?.side === "b" ? "hgfedcba" : "abcdefgh";
  const ranks = trap?.side === "b" ? "12345678" : "87654321";
  const destinations = board && selected ? board.moves({ square: selected, verbose: true }).map(move => move.to) : [];

  return <div className="astroid-solver">
    <header className="astroid-heading"><div><h1>Astroid <em>Solver</em></h1><p>3 traps per boss · 10 seconds per trap</p></div><button onClick={onClose}>Back to arcade</button></header>
    {storageError && <p role="alert">Your sector is cleared for this session, but progress could not be saved on this device.</p>}
    {!run ? <>
      <section className="astroid-intro"><AstroidScene color={ASTROID_BOSSES[Math.min(cleared, ASTROID_BOSSES.length - 1)].color} /><div><p className="section-kicker">{cleared === ASTROID_BOSSES.length ? "ALL SECTORS CLEARED" : `SECTOR ${Math.min(cleared + 1, ASTROID_BOSSES.length)} AWAITS`}</p><h2>How to play</h2><p>Find checkmate in one move in familiar opening traps and classic mating nets. Solve all three traps to defeat a boss and unlock the next sector.</p><p>A wrong legal move or a timeout destroys your ship. Retry the whole set of three. The clock keeps running if you switch tabs.</p><small>{cleared} / {ASTROID_BOSSES.length} sectors cleared · Progress saved on this device for this {accountId === "guest" ? "guest" : "account"}.</small></div></section>
      <section className="astroid-ladder" aria-label="Astroid boss ladder">{ASTROID_BOSSES.map((entry, index) => <article className={`astroid-rung${index > cleared ? " astroid-rung-locked" : ""}`} key={entry.name}><span className="astroid-rank">{String(index + 1).padStart(2, "0")}</span><div className="astroid-boss-art"><AstroidArtwork color={entry.color} /></div><div className="astroid-rung-copy"><small>{index < cleared ? "CLEARED" : index === cleared ? "NEXT MISSION" : "LOCKED"} / 3 TRAPS</small><h2>{entry.name}</h2>{index > cleared && <small>Clear {ASTROID_BOSSES[index - 1].name} first</small>}</div><GameStartButton size="small" disabled={index > cleared} onClick={() => launch(index)} aria-label={`${index < cleared ? "Replay" : "Launch"} sector ${index + 1}`}>{index < cleared ? "Replay" : index > cleared ? "Locked" : "Launch"}</GameStartButton></article>)}</section>
    </> : <>
      <div className="astroid-mission-heading"><button onClick={() => commit(null)}>Boss ladder</button><span>SECTOR {run.boss + 1} / {boss?.name}</span><div className="astroid-trap-dots" aria-label={`Trap ${run.trap + 1} of 3`}>{[0, 1, 2].map(index => <span key={index} className={index < run.trap || (index === run.trap && won) ? "cleared" : index === run.trap ? "current" : ""}>{index + 1}</span>)}</div></div>
      <div className="astroid-arena">
        <div className="astroid-board-frame">
          <div className="astroid-ranks" aria-hidden="true">{[...ranks].map(rank => <span key={rank}>{rank}</span>)}</div>
          <div className="astroid-board chessboard" role="group" aria-label="Astroid trap chessboard" style={{ "--board-square-light": light, "--board-square-dark": dark } as CSSProperties}>
            {[...ranks].flatMap(rank => [...files].map(file => {
              const square = `${file}${rank}` as Square; const piece = board!.get(square);
              const isLight = (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0;
              return <BoardSquare key={square} square={square} piece={piece} theme={theme} positionKey={run.fen} canDrag={!!playing && !promotion && piece?.color === trap!.side} disabled={!playing || !!promotion}
                className={`astroid-square ${isLight ? "square-light" : "square-dark"}${selected === square ? " selected" : ""}${destinations.includes(square) ? " legal-target" : ""}`}
                aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : " empty"}`} aria-pressed={selected === square}
                onPickUp={() => setSelected(square)} onMovePiece={(from, to, point) => move(from, to, point)} onClick={event => {
                  if (selected && destinations.includes(square)) move(selected, square, { x: event.clientX, y: event.clientY });
                  else setSelected(piece?.color === trap!.side && selected !== square ? square : null);
                }} onKeyDown={event => { if (event.key === "Escape") setSelected(null); }} />;
            }))}
          </div>
          <div className="astroid-files" aria-hidden="true">{[...files].map(file => <span key={file}>{file}</span>)}</div>
        </div>
        <BoardPanel className="astroid-mission-panel">
          {playing ? <><p className="section-kicker">TRAP {run.trap + 1} / 3</p><h2>{trap!.side === "w" ? "White" : "Black"} to move</h2><p>Find checkmate in one move.</p><TrapTimer key={run.deadline} deadline={run.deadline} onExpire={() => { const active = current.current; if (active) { const next = expireAstroidRun(active, performance.now()); if (next !== active) commit(next); } }} /><AstroidScene color={boss!.color} /><p className="astroid-control-note">Click a piece, then a destination. You can also drag, or use Tab and Enter.</p></> : <div className="astroid-outcome" tabIndex={-1} ref={result}>
            <AstroidScene key={`${run.boss}-${run.trap}-${run.phase}`} color={boss!.color} outcome={won ? "win" : "loss"} />
            <h2 role="status">{run.phase === "complete" ? "Sector cleared!" : won ? "Asteroid destroyed!" : "Ship destroyed!"}</h2>
            <p>{won ? `${run.san} · ${trap!.title}` : run.reason}</p>
            {!won && <p>The mating move: <strong>{trap!.solutions.map(solution => solution.san).join(" or ")}</strong>. Look for checks that cover every escape square.</p>}
            <a href={trap!.source} target="_blank" rel="noreferrer">Explore this trap</a>
            {run.phase === "solved" && <button disabled={!effectReady} onClick={() => { const active = current.current; if (active) commit(nextAstroidTrap(active, performance.now())); }}>Next trap</button>}
            {run.phase === "lost" && <button disabled={!effectReady} onClick={() => launch(run.boss)}>Retry all 3 traps</button>}
            {run.phase === "complete" && <><p>{run.boss === ASTROID_BOSSES.length - 1 ? "Every asteroid boss is defeated. Replay any sector from the ladder." : `${ASTROID_BOSSES[run.boss + 1].name} is now unlocked.`}</p>{run.boss < ASTROID_BOSSES.length - 1 && <button disabled={!effectReady} onClick={() => launch(run.boss + 1)}>Launch next sector</button>}</>}
          </div>}
        </BoardPanel>
      </div>
      {promotion && playing && <PromotionMenu position={promotion} color={trap!.side as "w" | "b"} theme={theme} onChoose={choice => move(promotion.from, promotion.to, promotion, choice)} onCancel={() => setPromotion(null)} />}
    </>}
  </div>;
}
