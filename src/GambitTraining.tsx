import { gambitOutcome } from "./gambitOutcome";
import { gambitBriefing } from "./gambitBriefing";
import { NotationText, NotationToken } from "./ChessNotation";
import { useEffect, useMemo, useState } from "react";
import { Chess, type Square, type Move } from "./chess";
import catalog from "./gambits.json";
import { requestStockfishMove } from "./stockfish";
import { BOSS_CHARACTERS, bossThumbnail } from "./bossArtwork";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import "./gambitTraining.css";

type Gambit = typeof catalog[number];
export function trainingLine(pgn: string): Move[] { const game = new Chess(); game.loadPgn(pgn); return game.history({verbose:true}); }
function instruction(move: Move | undefined) {
 if (!move) return "The opening line is complete. Keep developing and test the compensation against Stockfish.";
 const piece = ({p:"pawn",n:"knight",b:"bishop",r:"rook",q:"queen",k:"king"})[move.piece];
 const replyPosition = new Chess(move.after);
 const takers = replyPosition.moves({verbose:true}).filter(reply=>reply.to===move.to && reply.captured);
 const offer = move.piece === "p" && !move.captured && takers.length ? ` Your pawn on ${move.to} can now be taken with ${takers.map(reply=>reply.san).join(" or ")}. You are inviting a capture; use the following moves to learn how this line trades material for activity.` : "";
 const purpose = move.san.startsWith("O-O") ? "Castle to shelter your king and connect your rooks." : move.captured ? `Capture the ${move.captured === "p" ? "pawn" : "piece"} on ${move.to} to follow this variation's exchange sequence.` : move.piece === "p" ? "This pawn move establishes the pawn structure for this variation. A gambit offers material for activity; keep development and king safety in mind." : `Bring your ${piece} to ${move.to} as this variation develops. Keep your pieces active rather than chasing material.`;
 return `Play ${move.san}: ${move.from} to ${move.to}. ${purpose}${offer}${move.san.endsWith("+") ? " This also gives check." : ""}`;
}
export default function GambitTraining({accountId,theme,onClose}: {accountId:string;theme:PieceStyle;onClose:()=>void}) {
 const key = `arcade-gambit-training-v1:${accountId}`;
 const [completed,setCompleted] = useState<string[]>(()=>{try { const data:unknown=JSON.parse(localStorage.getItem(key)??"[]"); return Array.isArray(data)?data.filter((v):v is string=>typeof v==="string"):[]; } catch { return []; }});
 const [saveError,setSaveError]=useState(false);
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<Gambit|null>(null);
 const [scenario,setScenario]=useState(0);
 const [briefingOpen,setBriefingOpen]=useState(false);
 const [pgn,setPgn]=useState("");
 const [side,setSide]=useState<"w"|"b">("w");
 const [from,setFrom]=useState<Square|null>(null);
 const [feedback,setFeedback]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [practice,setPractice]=useState(false);
 const [voice,setVoice]=useState(false);
 const game=useMemo(()=>{const g=new Chess(); if(pgn)g.loadPgn(pgn); return g;},[pgn]);
 const line=useMemo(()=>selected?trainingLine(selected.scenarios[scenario].pgn):[],[selected,scenario]);
 const ply=game.history().length;
 const done=!!selected && ply>=line.length;
 const scenarioKey=selected?`${selected.id}:${selected.scenarios[scenario].pgn}:${side}`:"";
 const cleared=(g:Gambit,index:number)=>completed.some(value=>value===`${g.id}:${g.scenarios[index].pgn}:w`||value===`${g.id}:${g.scenarios[index].pgn}:b`);
 const briefing=useMemo(()=>selected?gambitBriefing(selected.name,selected.scenarios[0].pgn):null,[selected]);
 const role=briefing && side===briefing.offeringSide ? "Gambit player" : "Defender";
 const boss=selected?BOSS_CHARACTERS[selected.boss]:null;
 const outcome=useMemo(()=>selected&&done?gambitOutcome(selected.name,selected.scenarios[0].pgn,selected.scenarios[scenario].pgn,side):null,[selected,done,scenario,side]);
 const message=feedback|| (done&&!practice?"Scenario cleared! Try every listed variation to master this gambit, or continue against Stockfish.":game.turn()!==side?"Watch my reply. I am following this scenario so you can learn its move order.":instruction(line[ply]));
 useEffect(()=>{if(briefingOpen||!selected||!done||practice||completed.includes(scenarioKey))return; const next=[...completed,scenarioKey];setCompleted(next);try{localStorage.setItem(key,JSON.stringify(next));setSaveError(false);}catch{setSaveError(true);}},[briefingOpen,selected,done,practice,scenarioKey,completed,key]);
 useEffect(()=>{if(!voice||!selected||briefingOpen||!("speechSynthesis" in window))return; window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(done&&!practice&&outcome ? `${message} ${outcome.material} ${outcome.benefit} ${outcome.next} ${outcome.opponent} ${outcome.transition}` : message);window.speechSynthesis.speak(speech);return()=>window.speechSynthesis.cancel();},[voice,message,selected,briefingOpen,done,practice,outcome]);
 useEffect(()=>{
  if(briefingOpen||!selected||game.turn()===side||game.isGameOver()||(!practice&&done))return;
  const abort=new AbortController();setBusy(true);setError("");
  const expected=line[ply];const roots=!practice&&expected?[expected.from+expected.to+(expected.promotion??"")]:undefined;
  requestStockfishMove(game.fen(),game.pgn(),1500,abort.signal,roots).then(move=>{
   if(abort.signal.aborted)return;
   if(!move)throw Error("No engine move returned");
   const next=new Chess();if(pgn)next.loadPgn(pgn);next.move(move);setPgn(next.pgn());setFeedback("");
  }).catch((e:unknown)=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Engine unavailable. Retry to continue.");}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
  return()=>abort.abort();
 },[briefingOpen,selected,game,side,practice,done,line,ply,pgn,retry]);
 function start(g:Gambit,index:number,color?:"w"|"b") {
  setBriefingOpen(true);setSelected(g);setScenario(index);setPgn("");setFrom(null);setFeedback("");setError("");setBusy(false);setPractice(false);
  setSide(color??gambitBriefing(g.name,g.scenarios[0].pgn).offeringSide);
 }
 function play(to:Square,promotion?:string) {
  if(briefingOpen||!from||busy||error||game.turn()!==side||(!practice&&done))return;
  const next=new Chess();if(pgn)next.loadPgn(pgn);
  let move:Move;try{move=next.move({from,to,...(promotion?{promotion}:{})});}catch{setFeedback(`That move is illegal in this position. ${instruction(line[ply])}`);setFrom(null);return;}
  const expected=line[ply];
  if(!practice&&expected&&(move.from!==expected.from||move.to!==expected.to||move.promotion!==expected.promotion)) {
   setFeedback(`${move.san} is legal, but leaves the move order of this scenario. This is a variation mismatch, not necessarily a bad chess move. ${instruction(expected)} Your position has been restored; try again.`);setFrom(null);return;
  }
  setPgn(next.pgn());setFrom(null);setFeedback("");
 }
 const [promotionTarget,setPromotionTarget]=useState<Square|null>(null);
 const files=side==="w"?"abcdefgh":"hgfedcba";
 const ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
 const guidedMove = !briefingOpen && !practice && !done && game.turn() === side ? line[ply] : undefined;
 const filtered=catalog.filter(g=>g.name.toLowerCase().includes(query.toLowerCase()));
 return <section className="gambit-training">
  <div className="gambit-heading"><div><small>THE GAMBIT ACADEMY</small><h1>Trade a pawn. Take the initiative.</h1><p>{catalog.length} named gambits · {catalog.reduce((n,g)=>n+g.scenarios.length,0)} opening scenarios · Stockfish sparring</p></div><button onClick={onClose}>Back to arcade</button></div>
  {saveError&&<p role="alert">Progress could not be saved to this browser. Keep this page open to retain this session's clears.</p>}
  {!selected?<><p>Choose a boss and follow the guided moves. Clear every listed scenario to master its opening lines. Mastery is local to this browser and profile.</p><label>Find a gambit <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="King's, Evans, Smith-Morra…"/></label><p>{filtered.length} gambits found</p><div className="gambit-catalog">{filtered.map(g=>{const count=g.scenarios.filter((_,i)=>cleared(g,i)).length;return <button key={g.id} onClick={()=>start(g,g.scenarios.findIndex((_,i)=>!cleared(g,i))<0?0:g.scenarios.findIndex((_,i)=>!cleared(g,i)))}><strong>{g.name}</strong><span>Keeper: {g.name.replace(/^.*?: /,"")} Sentinel</span><span>{count===g.scenarios.length?"MASTERED":g.scenarios.length > 1 ? `${count} / ${g.scenarios.length} scenarios` : "Start training"}</span></button>;})}</div></>:<>
  <button onClick={()=>{setSelected(null);setPgn("");setFrom(null);setPromotionTarget(null);}}>All gambits</button>
  {briefingOpen&&briefing ? <section className="gambit-briefing" aria-labelledby="gambit-briefing-title">
    {boss&&<img src={bossThumbnail(boss.folder,__BOSS_PORTRAITS__)} alt="" width={112} height={112}/>}
    <small>BEFORE WE PLAY</small><h2 id="gambit-briefing-title">The idea behind {selected.name}</h2>
    <p><NotationText text={briefing.idea}/></p>
    <h3>Your role: {role} ({side==="w"?"White":"Black"})</h3>
    <p>{role==="Gambit player"?"You are playing the side offering the gambit. Stockfish will play its opponent.":"You are defending against the gambit. Stockfish will play the side offering it."}</p>
    <p><NotationText text={role==="Gambit player"?briefing.attack:briefing.defense}/></p>
    <p>You can swap sides to {role==="Gambit player"?"try defending against the gambit instead":"try offering the gambit yourself"}. Swapping sides starts this scenario again.</p>
    <div className="gambit-briefing-actions"><button onClick={()=>setBriefingOpen(false)}>Understood</button><button onClick={()=>start(selected,scenario,side==="w"?"b":"w")}>{role==="Gambit player"?"Swap sides to defend":"Swap sides to play the gambit"}</button></div>
  </section> : <>
  <div className="gambit-arena"><div><div className="gambit-board-frame"><div className="gambit-rank-axis" aria-hidden="true">{ranks.map(rank=><span key={rank}>{rank}</span>)}</div><div className="gambit-board" role="group" aria-label={`${side==="w"?"White":"Black"} training board`}>{ranks.flatMap(rank=>[...files].map(file=>{const square=`${file}${rank}` as Square;const piece=game.get(square);const legal=from&&game.moves({square:from,verbose:true}).some(m=>m.to===square);return <button key={square} className={`gambit-square ${(file.charCodeAt(0)+rank)%2?"light":"dark"} ${from===square?"selected":""} ${legal?"legal":""} ${guidedMove?.from===square?"hint-from":""} ${guidedMove?.to===square?"hint-to":""}`} aria-label={`${square}${piece?` ${piece.color==="w"?"white":"black"} ${piece.type}`:" empty"}`} disabled={busy||!!error||(!practice&&done)||game.turn()!==side} onClick={()=>{if(piece?.color===side){setFrom(square);return;}if(from){if(game.get(from)?.type==="p"&&(rank===1||rank===8)){setPromotionTarget(square);}else play(square);}}}>{piece&&<PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare/>}</button>;}))}</div><div className="gambit-file-axis" aria-hidden="true">{[...files].map(file=><span key={file}>{file}</span>)}</div></div>
  {guidedMove&&<p className="gambit-move-key"><span className="gambit-from-key">From <NotationToken token={guidedMove.from}/></span><span aria-hidden="true"> &rarr; </span><span className="gambit-to-key">To <NotationToken token={guidedMove.to}/></span></p>}
  {promotionTarget&&<div role="group" aria-label="Choose promotion">{["q","r","b","n"].map(p=><button key={p} onClick={()=>{play(promotionTarget,p);setPromotionTarget(null);}}>Promote to {p}</button>)}<button onClick={()=>setPromotionTarget(null)}>Cancel</button></div>}
  <p>You play {side==="w"?"White":"Black"} · {practice?"Free play against Stockfish":`Guided move ${Math.min(ply,line.length)} / ${line.length}`}</p><p className="gambit-history"><NotationText text={game.history().join(" ")||"Starting position"}/></p></div>
  <aside className="gambit-coach"><p className="gambit-role"><strong>Your role: {role} ({side==="w"?"White":"Black"})</strong><br/>Swap sides with "Train the other side" to {role==="Gambit player"?"practice defending against this gambit":"offer the gambit yourself"}.</p><button onClick={()=>{setBriefingOpen(true);setBusy(false);setFrom(null);}}>Review gambit idea</button><p className="gambit-note">Click underlined chess notation for an explanation.</p>{boss&&<img src={bossThumbnail(boss.folder,__BOSS_PORTRAITS__)} alt={`${selected.name} boss`} />}<h2>{selected.name} Sentinel</h2><p>Guardian of {selected.name}</p><label><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/> Speak coaching aloud</label><p className="gambit-speech" aria-live="polite">{game.isGameOver()?`Game over: ${game.isCheckmate()?"checkmate":"draw"}. Restart to try again.`:<NotationText text={message}/>}</p>{busy&&<p role="status">Stockfish is thinking…</p>}{error&&<div role="alert"><p>{error}</p><button onClick={()=>setRetry(v=>v+1)}>Retry Stockfish</button></div>}
  {selected.scenarios.length > 1 && <label>Scenario<select value={scenario} onChange={e=>start(selected,Number(e.target.value),side)}>{selected.scenarios.map((s,i)=><option key={s.pgn} value={i}>{cleared(selected,i)?"[cleared] ":""}{i+1}. {s.name}</option>)}</select></label>}
  <p>{selected.scenarios.length > 1 && `${selected.scenarios.filter((_,i)=>cleared(selected,i)).length} / ${selected.scenarios.length} cleared`}{selected.scenarios.every((_,i)=>cleared(selected,i)) ? " MASTERED" : ""}</p>
  <button onClick={()=>start(selected,scenario,side)}>Restart scenario</button><button onClick={()=>start(selected,scenario,side==="w"?"b":"w")}>Train the other side</button>
  {done&&!practice&&outcome&&<><section className="gambit-outcome" aria-labelledby="gambit-outcome-title"><h3 id="gambit-outcome-title">Gambit played. What comes next?</h3><h4>The position you reached</h4><p><NotationText text={outcome.material}/></p><h4>Why try this gambit?</h4><p><NotationText text={outcome.benefit}/></p><h4>Your next plan</h4><p><NotationText text={outcome.next}/></p><h4>What to expect from your opponent</h4><p><NotationText text={outcome.opponent}/></p><p>{outcome.transition}</p></section><button onClick={()=>{setPractice(true);setFeedback("");}}>Play on against Stockfish</button>{scenario+1<selected.scenarios.length&&<button onClick={()=>start(selected,scenario+1,side)}>Next scenario</button>}</>}
  <p className="gambit-note">Guided replies are constrained to this opening line. Free play uses unrestricted Stockfish. A cleared line is opening practice, not proof of a winning position.</p></aside></div></>}</>}
  <p className="gambit-note">Opening names and lines: <a href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noreferrer">Lichess chess-openings</a> (CC0). Includes every gambit-labelled entry in the imported catalogue; chess has no finite authoritative list of all gambits.</p>
 </section>;
}
