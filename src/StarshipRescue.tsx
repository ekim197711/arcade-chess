import { useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "./chess";
import { BoardSquare, BoardPanel } from "./BoardShared";
import { PromotionMenu, type PromotionPiece } from "./PromotionMenu";
import type { PieceStyle } from "./PieceArtwork";
import { REPAIRS, repairsWithMove } from "./starshipRules";
import { useStarshipSave } from "./useStarshipSave";
import "./starshipRescue.css";

function CrashSite({ repaired, launched }: { repaired: number; launched: boolean }) {
  return <div className={`rescue-scene ${launched ? "rescue-departed" : repaired === 0 ? "rescue-crash" : ""}`}>
    <svg viewBox="0 0 400 260" role="img" aria-label={launched ? "The repaired starship flies home" : `Pilot Nova beside the crashed starship. ${repaired} of 6 systems repaired.`}>
      <rect width="400" height="260" fill="#081323" />
      {[35, 92, 152, 213, 279, 350, 380].map((x, i) => <circle key={x} cx={x} cy={20 + (i * 37) % 120} r={i % 2 ? 1 : 2} fill="#b9edf2" />)}
      <circle cx="324" cy="60" r="29" fill="#304764" /><path d="M292 65q32 18 65-20" fill="none" stroke="#91a0bc" strokeWidth="5" />
      <path d="M0 205 62 156 110 193 190 161 265 200 335 176 400 201V260H0Z" fill="#253446" />
      <path d="M0 234Q190 190 400 231V260H0Z" fill="#46566b" />
      <ellipse cx="228" cy="229" rx="95" ry="10" fill="#172333" />
      <g className="rescue-ship">
        {repaired === 6 && <path className="rescue-flame" d="m174 194-62-8 46 23-43 8 65 3" fill="#ffcf73" />}
        <path d="m165 187 48-52 28 48 59 27-25 14-103-6Z" fill="#96b8c7" stroke="#172e47" strokeWidth="4" />
        <path d="m176 187 91-2 49 24-47 9-99-3Z" fill="#d0e0de" stroke="#172e47" strokeWidth="4" />
        <path d="m233 185 21-14 29 23h-48Z" fill={repaired >= 3 ? "#91f5eb" : "#38526a"} stroke="#172e47" strokeWidth="4" />
        <path d="m194 202 31-5-18 33-30-1Z" fill="#ce8e68" stroke="#172e47" strokeWidth="3" />
        {repaired === 0 && <path d="m231 202 11 6-9 8m49-11-9 5 12 5" fill="none" stroke="#172333" strokeWidth="3" />}
        {Array.from({ length: 6 }, (_, i) => <rect key={i} x={178 + i * 9} y="189" width="5" height="5" fill={i < repaired ? "#b8f89b" : "#74545b"} />)}
      </g>
      {!launched && <g className="rescue-pilot" stroke="#162b40" strokeWidth="3"><path d="m103 221-6 18m16-18 5 18" stroke="#e4d4ad" strokeWidth="8" /><rect x="92" y="191" width="27" height="33" rx="8" fill="#dfad73" /><circle cx="106" cy="181" r="16" fill="#d4e0df" /><path d="M93 177q14-10 25 1v10H94Z" fill="#467f98" /><path d="m118 198 14 8 8-9" stroke="#dfad73" strokeWidth="7" fill="none" /><rect x="99" y="201" width="12" height="8" fill="#91f5eb" /></g>}
    </svg>
    <span>{launched ? "SIGNAL RECEIVED · HEADING HOME" : repaired === 6 ? "ALL SYSTEMS ONLINE" : "DISTRESS SIGNAL · MOON K-64"}</span>
  </div>;
}

export default function StarshipRescue({ accountId, theme, light, dark, onClose, onRepair }: {
  accountId: string; theme: PieceStyle; light: string; dark: string; onClose: () => void; onRepair: () => void;
}) {
  const { save, commit, status, retry } = useStarshipSave(accountId);
  const [started, setStarted] = useState(false);
  const [replay, setReplay] = useState<number | null>(null);
  const [solvedFen, setSolvedFen] = useState<string | null>(null);
  const [solvedIndex, setSolvedIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState("");
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; x: number; y: number } | null>(null);
  const index = solvedIndex ?? replay ?? Math.min(save.repaired, REPAIRS.length - 1);
  const repair = REPAIRS[index];
  const board = useMemo(() => new Chess(solvedFen ?? repair.puzzle.fen), [solvedFen, repair.puzzle.fen]);
  const playing = (started || save.repaired > 0) && (save.repaired < 6 || replay !== null || solvedIndex !== null);
  const active = playing && !solvedFen;
  const side = board.turn();
  const solution = repair.puzzle.solutions[0];
  const destinations = selected ? board.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  function clearPuzzle() { setSelected(null); setPromotion(null); setHint(0); setMessage(""); setSolvedFen(null); setSolvedIndex(null); }
  function move(from: Square, to: Square, point: { x: number; y: number }, choice?: PromotionPiece) {
    if (!active) return;
    const moves = board.moves({ verbose: true }).filter(move => move.from === from && move.to === to);
    if (!moves.length) return;
    if (moves.some(move => move.promotion) && !choice) { setPromotion({ from, to, ...point }); return; }
    setPromotion(null); setSelected(null);
    if (!repairsWithMove(index, { from, to, promotion: choice })) {
      setMessage("That move leaves an escape. No damage done — try another check."); return;
    }
    const result = new Chess(repair.puzzle.fen); const played = result.move({ from, to, promotion: choice });
    setSolvedIndex(index); setSolvedFen(result.fen()); setMessage(`${played.san} — ${repair.name} repaired!`);
    if (replay === null) commit({ repaired: index + 1, launched: false });
    onRepair();
  }
  const files = repair.puzzle.side === "b" ? "hgfedcba" : "abcdefgh";
  const ranks = repair.puzzle.side === "b" ? "12345678" : "87654321";
  const hintControls = <><button disabled={hint === 2} onClick={() => setHint(previous => Math.min(2, previous + 1))}>{hint === 0 ? "Hint" : hint === 1 ? "Show mating move" : "Hint revealed"}</button><p className="rescue-hint" aria-live="polite">{hint === 1 ? `Look for a check with the piece on ${solution.from}.` : hint === 2 ? `Move ${solution.from} to ${solution.to}: ${solution.san}` : "Need a hand? Hints are free."}</p></>;
  return <section className="starship-rescue">
    <header className="rescue-heading"><div><small>CHESS ARCADE / MINI MISSION</small><h1>Starship <em>Rescue</em></h1></div><button onClick={onClose}>Back to arcade</button></header>
    <div className="rescue-layout">
      <BoardPanel className="rescue-controls">
        <p className="section-kicker">REPAIR MANIFEST</p><h2>{save.repaired} / 6 systems</h2>
        <progress max={6} value={save.repaired} aria-label="Ship repairs completed" />
        <ol>{REPAIRS.map((entry, i) => <li key={entry.name} className={i < save.repaired ? "repaired" : i === index && playing ? "repair-current" : ""}><span aria-hidden="true">{i < save.repaired ? "✓" : String(i + 1).padStart(2, "0")}</span>{entry.name}</li>)}</ol>
        {active && <div className="rescue-desktop-hints">{hintControls}</div>}
        <p className="rescue-save" role="status">{status}</p>
        {status.includes("pending") && <button onClick={() => void retry()}>Retry cloud save</button>}
      </BoardPanel>
      <div className="rescue-center">
        {playing ? <><div className="rescue-board-caption"><strong>{repair.puzzle.side === "w" ? "White" : "Black"} to move</strong><span>Checkmate in one</span></div>
          <div className="rescue-board chessboard" role="group" aria-label="Starship repair chessboard" style={{ "--board-square-light": light, "--board-square-dark": dark } as CSSProperties}>
            {[...ranks].flatMap(rank => [...files].map(file => {
              const square = `${file}${rank}` as Square; const piece = board.get(square);
              return <BoardSquare key={square} square={square} piece={piece} theme={theme} positionKey={board.fen()} canDrag={active && !promotion && piece?.color === side} disabled={!active || !!promotion}
                className={`rescue-square ${(file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0 ? "square-light" : "square-dark"}${selected === square ? " selected" : ""}${destinations.includes(square) ? " legal-target" : ""}${hint > 0 && square === solution.from ? " rescue-hint-square" : ""}${hint === 2 && square === solution.to ? " rescue-hint-square" : ""}`}
                aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : " empty"}`} aria-pressed={selected === square}
                onPickUp={() => setSelected(square)} onMovePiece={move} onClick={event => {
                  if (selected && destinations.includes(square)) move(selected, square, { x: event.clientX, y: event.clientY });
                  else setSelected(piece?.color === side && selected !== square ? square : null);
                }} onKeyDown={event => { if (event.key === "Escape") { setSelected(null); setPromotion(null); } }}><small className="rescue-coordinate" aria-hidden="true">{square}</small></BoardSquare>;
            }))}
          </div><p className="rescue-feedback" role="status">{message || "Choose a piece, then its destination. Dragging works too."}</p>
          {active && <div className="rescue-mobile-hints">{hintControls}</div>}
          {solvedFen && <button className="rescue-next" onClick={() => { clearPuzzle(); if (replay !== null) setReplay(replay < 5 ? replay + 1 : null); }}>{index === 5 ? "Return to ship" : "Next repair"}</button>}
        </> : <div className="rescue-story"><CrashSite repaired={save.repaired} launched={save.launched} /><p className="section-kicker">{save.launched ? "MISSION COMPLETE" : save.repaired === 6 ? "READY FOR LIFTOFF" : "MAYDAY! MAYDAY!"}</p><h2>{save.launched ? "Next stop: home." : save.repaired === 6 ? "You fixed the ship!" : "A rough landing. A clever escape."}</h2><p>{save.launched ? "Nova and the little starship are safely on their way. All six repairs are saved." : save.repaired === 6 ? "Nova is back in the cockpit. Every system is green. Time to leave this dusty moon behind." : "Pilot Nova has crashed on a remote moon. The ship’s repair computer is locked by chess puzzles. Find six checkmates to rebuild the ship and fly home."}</p>
          {save.repaired === 0 ? <button onClick={() => setStarted(true)}>Help Nova · Start repairs</button> : !save.launched ? <button onClick={() => { commit({ repaired: 6, launched: true }); onRepair(); }}>Launch starship</button> : <button onClick={() => { clearPuzzle(); setReplay(0); }}>Replay repair puzzles</button>}
        </div>}
      </div>
      <BoardPanel className="rescue-details">{playing && <CrashSite repaired={save.repaired} launched={false} />}<p className="section-kicker">{playing ? `REPAIR ${index + 1} / 6` : "PILOT’S LOG"}</p><h2>{playing ? repair.name : "Nova · K-64"}</h2><p>{playing ? repair.detail : "Stranded, but not giving up. A little chess can go a long way."}</p>{playing && <><p>No timer. No lost lives. Every correct checkmate repairs one system.</p><div className="rescue-source"><small>PUZZLE</small><strong>{repair.puzzle.title}</strong><a href={repair.puzzle.source} target="_blank" rel="noreferrer">View puzzle source ↗</a></div></>}<small>Click or drag pieces. Keyboard: Tab to a square, Enter to select or move.</small></BoardPanel>
    </div>
    {promotion && active && <PromotionMenu position={promotion} color={side} theme={theme} onChoose={choice => move(promotion.from, promotion.to, promotion, choice)} onCancel={() => setPromotion(null)} />}
  </section>;
}
