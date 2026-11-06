import { ArrowLeft, LayoutGrid, Play, Repeat2 } from "lucide-react";
import { suggestGambit } from "./gambitSuggestion";
import { GambitMoveDiagram } from "./GambitMoveDiagram";
import { gambitIllustrations } from "./gambitIllustrations";
import { gambitStatus } from "./gambitStatus";
import { acceptingGambitLine } from "./gambitAcceptance";
import { BoardSquare, BoardPanel, PremoveControl } from "./BoardShared";
import { PromotionMenu, type PromotionPosition } from "./PromotionMenu";
import { usePremoveQueue, premoveBoard, type PlannedMove } from "./premoves";
import { BoardAnnotations } from "./BoardAnnotations";
import { gambitOutcome } from "./gambitOutcome";
import { gambitBriefing } from "./gambitBriefing";
import { NotationText, NotationToken } from "./ChessNotation";
import { useEffect, useMemo, useState, useRef } from "react";
import { Chess, type Square, type Move } from "./chess";
import catalog from "./gambits.json";
import { requestStockfishMove } from "./stockfish";
import { BOSS_CHARACTERS, bossThumbnail } from "./bossArtwork";
import { type PieceStyle } from "./PieceArtwork";
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
export default function GambitTraining({accountId,theme,onClose,light,dark}: {accountId:string;theme:PieceStyle;onClose:()=>void;light?:string;dark?:string}) {
 const key = `arcade-gambit-training-v1:${accountId}`;
 const [completed,setCompleted] = useState<string[]>(()=>{try { const data:unknown=JSON.parse(localStorage.getItem(key)??"[]"); return Array.isArray(data)?data.filter((v):v is string=>typeof v==="string"):[]; } catch { return []; }});
 const playedKey = `arcade-gambit-training-played-v1:${accountId}`;
 const [played,setPlayed]=useState<string[]>(()=>{try{const value:unknown=JSON.parse(localStorage.getItem(playedKey)??"[]");return Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"):[];}catch{return [];}});
 const suggestion=useMemo(()=>suggestGambit(catalog,played,completed),[played,completed]);
 const [saveError,setSaveError]=useState(false);
 const [query,setQuery]=useState("");
 const [selected,setSelected]=useState<Gambit|null>(null);
 const [scenario,setScenario]=useState(0);
 const [briefingOpen,setBriefingOpen]=useState(false);
 const [pgn,setPgn]=useState("");
 const [side,setSide]=useState<"w"|"b">("w");
 const [from,setFrom]=useState<Square|null>(null);
 const {premoves,setPremoves,takePremove}=usePremoveQueue<PlannedMove>();
 const premovesRef=useRef(premoves);premovesRef.current=premoves;
 const [promotionMove,setPromotionMove]=useState<{from:Square;to:Square;position:PromotionPosition}|null>(null);
 const [feedback,setFeedback]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [practice,setPractice]=useState(false);
 const [voice,setVoice]=useState(false);
 const [practiceHint,setPracticeHint]=useState<{fen:string;move?:Move;error?:string}|null>(null);
 const [hintRetry,setHintRetry]=useState(0);
 const lesson=useMemo(()=>selected?acceptingGambitLine(selected.name,selected.scenarios[0].pgn,selected.scenarios[scenario].pgn):null,[selected,scenario]);
 const initialFen=lesson?.line[0]?.before;
 const game=useMemo(()=>{const g=new Chess(initialFen);if(pgn)g.loadPgn(pgn);return g;},[pgn,initialFen]);
 const line=lesson?.line ?? [];
 const plannedBoard=useMemo(()=>premoveBoard(game,premoves,side),[game,premoves,side]);
 const queuingPremove=game.turn()!==side||premoves.length>0;
 const targets=from?(queuingPremove?plannedBoard.targets(from):game.moves({square:from,verbose:true}).map(move=>move.to)):[];
 const illustrations=useMemo(()=>lesson?gambitIllustrations(lesson):[],[lesson]);
 const ply=game.history().length;
 const done=!!selected && !!lesson?.accepted && ply>=line.length;
 const scenarioKey=selected?`${selected.id}:${selected.scenarios[scenario].pgn}:accepted-v2:${side}`:"";
 const cleared=(g:Gambit,index:number)=>completed.some(value=>value===`${g.id}:${g.scenarios[index].pgn}:accepted-v2:w`||value===`${g.id}:${g.scenarios[index].pgn}:accepted-v2:b`);
 const briefing=useMemo(()=>selected?gambitBriefing(selected.name,selected.scenarios[0].pgn):null,[selected]);
 const role=briefing && side===briefing.offeringSide ? "Gambit player" : "Defender";
 const boss=selected?BOSS_CHARACTERS[selected.boss]:null;
 const outcome=useMemo(()=>selected&&done?gambitOutcome(selected.name,selected.scenarios[0].pgn,lesson!.pgn,side):null,[selected,done,lesson,side]);
 const event=useMemo(()=>lesson?gambitStatus(game.history({verbose:true}),lesson,side):null,[game,lesson,side]);
 const currentHint=practiceHint?.fen===game.fen()?practiceHint:undefined;
 const suggestedMove = practice ? currentHint?.move : line[ply];
 useEffect(()=>{
  if(!practice||briefingOpen||!selected||game.turn()!==side||game.isGameOver())return;
  const abort=new AbortController();
  const fen=game.fen();
  setPracticeHint(null);
  requestStockfishMove(fen,game.pgn(),3190,abort.signal,undefined,{fullStrength:true}).then(move=>{
   if(abort.signal.aborted||!move)return;
   const position=new Chess(fen);
   setPracticeHint({fen,move:position.move(move)});
  }).catch((cause:unknown)=>{
   if(!abort.signal.aborted)setPracticeHint({fen,error:cause instanceof Error?cause.message:"Move guidance is unavailable."});
  });
  return()=>abort.abort();
 },[practice,briefingOpen,selected,game,side,pgn,hintRetry]);
 const message=feedback|| (done&&!practice?"Scenario cleared! Try every listed variation to master this gambit, or continue against Stockfish.":game.turn()!==side?(practice?"Watch Stockfish's reply, then look for your next move.":"Watch my reply. I am following this scenario so you can learn its move order."):practice?(suggestedMove?`Stockfish recommends ${suggestedMove.san}. ${instruction(suggestedMove)}`:currentHint?.error?"Move guidance is unavailable. Retry to show the recommended move.":"Finding the best continuation for this position..."):instruction(suggestedMove));
 useEffect(()=>{if(briefingOpen||!selected||!done||practice||completed.includes(scenarioKey))return; const next=[...completed,scenarioKey];setCompleted(next);try{localStorage.setItem(key,JSON.stringify(next));setSaveError(false);}catch{setSaveError(true);}},[briefingOpen,selected,done,practice,scenarioKey,completed,key]);
 useEffect(()=>{if(!voice||!selected||briefingOpen||!("speechSynthesis" in window))return; window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance((event ? `${event.label} ${event.detail} ` : "") + (done&&!practice&&outcome ? `${message} ${outcome.material} ${outcome.benefit} ${outcome.next} ${outcome.opponent} ${outcome.transition}` : message));window.speechSynthesis.speak(speech);return()=>window.speechSynthesis.cancel();},[voice,message,selected,briefingOpen,done,practice,outcome,event?.phase,event?.label,event?.detail]);
 useEffect(()=>{
  if(briefingOpen||!selected||game.turn()===side||game.isGameOver()||(!practice&&done))return;
  const abort=new AbortController();setBusy(true);setError("");
  const expected=line[ply];const roots=!practice&&expected?[expected.from+expected.to+(expected.promotion??"")]:undefined;
  requestStockfishMove(game.fen(),game.pgn(),1500,abort.signal,roots).then(move=>{
   if(abort.signal.aborted)return;
   if(!move)throw Error("No engine move returned");
   const next=new Chess(initialFen);if(pgn)next.loadPgn(pgn);next.move(move);setPgn(next.pgn());setFeedback("");setFrom(selected=>selected&&premoveBoard(next,premovesRef.current,side).get(selected)?.color===side?selected:null);
  }).catch((e:unknown)=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:"Engine unavailable. Retry to continue.");}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
  return()=>abort.abort();
 },[briefingOpen,selected,game,side,practice,done,line,ply,pgn,retry]);
 function start(g:Gambit,index:number,color?:"w"|"b") {
  setPremoves([]);setPromotionMove(null);setBriefingOpen(true);setSelected(g);setScenario(index);setPgn("");setFrom(null);setFeedback("");setError("");setBusy(false);setPractice(false);
  setSide(color??gambitBriefing(g.name,g.scenarios[0].pgn).offeringSide);
 }
 function beginTraining() {
  if(selected&&!played.includes(selected.id)){
   const next=[...played,selected.id];setPlayed(next);
   try{localStorage.setItem(playedKey,JSON.stringify(next));}catch{setSaveError(true);}
  }
  setBriefingOpen(false);
 }
 function play(to:Square,promotion?:string,origin:Square|null=from,execute=false,anchor?:PromotionPosition) {
  if(game.isGameOver()||briefingOpen||!origin||error||(!practice&&done))return;
  if(!execute&&queuingPremove){
   if(!plannedBoard.targets(origin).includes(to)){setPremoves([]);setFeedback("That premove cannot be planned from this position.");return;}
   setPremoves(previous=>[...previous,{from:origin,to}]);setFrom(null);return;
  }
  if(game.turn()!==side)return;
  const legal=game.moves({square:origin,verbose:true}).filter(move=>move.to===to);
  if(!promotion&&legal.some(move=>!!move.promotion)){setPromotionMove({from:origin,to,position:anchor??{x:window.innerWidth/2,y:window.innerHeight/2}});return;}
  const next=new Chess(initialFen);if(pgn)next.loadPgn(pgn);
  let move:Move;try{move=next.move({from:origin,to,...(promotion?{promotion}:{})});}catch{setPremoves([]);setFeedback(`That move is illegal in this position. ${instruction(suggestedMove)}`);setFrom(null);return;}
  const expected=line[ply];
  if(!practice&&expected&&(move.from!==expected.from||move.to!==expected.to||move.promotion!==expected.promotion)) {
   setPremoves([]);setFeedback(`${move.san} is legal, but leaves the move order of this scenario. This is a variation mismatch, not necessarily a bad chess move. ${instruction(expected)} Your position has been restored; try again.`);setFrom(null);return;
  }
  setPgn(next.pgn());setFrom(null);setFeedback("");
 }

 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setPremoves([]);setFrom(null);}};
  window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);
 },[setPremoves]);
 useEffect(()=>{
  if(game.isGameOver()||briefingOpen||(!practice&&done)||game.turn()!==side||promotionMove||error)return;
  const queued=takePremove(game.fen());if(queued)play(queued.to,undefined,queued.from,true);
 },[game,side,briefingOpen,done,practice,promotionMove,error,premoves,takePremove]);
 const files=side==="w"?"abcdefgh":"hgfedcba";
 const ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
 const guidedMove = !briefingOpen && (practice || !done) && !game.isGameOver() && game.turn() === side ? suggestedMove : undefined;
 const lastMove=game.history({verbose:true}).at(-1);
 const filtered=catalog.filter(g=>g.name.toLowerCase().includes(query.toLowerCase()));
 return <section style={{"--training-board-light":light,"--training-board-dark":dark,"--board-square-light":light,"--board-square-dark":dark} as import("react").CSSProperties} className={`gambit-training ${selected ? briefingOpen ? "gambit-training-explaining" : "gambit-training-playing" : ""}`}>
  <div className="gambit-heading"><div><small>THE GAMBIT ACADEMY</small><h1>{selected?.name ?? "Gambit Academy"}</h1>{!selected&&<p>{catalog.length} named gambits · {catalog.reduce((n,g)=>n+g.scenarios.length,0)} opening scenarios · Stockfish sparring</p>}</div>{!selected&&<button onClick={onClose}>Back to arcade</button>}</div>
  {saveError&&<p role="alert">Progress could not be saved to this browser. Keep this page open to retain this session's clears.</p>}
  {!selected?<><p>Choose a boss and follow the guided moves. Clear every listed scenario to master its opening lines. Mastery is local to this browser and profile.</p><section className="gambit-suggestion" aria-labelledby="gambit-suggestion-title"><div><small id="gambit-suggestion-title">Suggested for you</small>{suggestion?<><h2>{suggestion.gambit.name}</h2><p>{suggestion.reason}</p><span className="gambit-note">Easiest unplayed introduction</span></>:<><h2>You have tried every gambit!</h2><p>Choose any gambit below to keep practicing.</p></>}</div>{suggestion&&<button onClick={()=>start(suggestion.gambit,suggestion.scenarioIndex)}>Try this gambit</button>}</section><label>Find a gambit <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="King's, Evans, Smith-Morra…"/></label><p>{filtered.length} gambits found</p><div className="gambit-catalog">{filtered.map(g=>{const count=g.scenarios.filter((_,i)=>cleared(g,i)).length;return <button key={g.id} onClick={()=>start(g,g.scenarios.findIndex((_,i)=>!cleared(g,i))<0?0:g.scenarios.findIndex((_,i)=>!cleared(g,i)))}><strong>{g.name}</strong><span>Keeper: {g.name.replace(/^.*?: /,"")} Sentinel</span><span>{count===g.scenarios.length?"MASTERED":g.scenarios.length > 1 ? `${count} / ${g.scenarios.length} scenarios` : "Start training"}</span></button>;})}</div></>:<>
  {briefingOpen&&briefing ? <div className="gambit-briefing-layout"><section className="gambit-briefing" aria-labelledby="gambit-briefing-title">
    {boss&&<img src={bossThumbnail(boss.folder,__BOSS_PORTRAITS__)} alt="" width={112} height={112}/>}
    <small>BEFORE WE PLAY</small><h2 id="gambit-briefing-title">The idea behind {selected.name}</h2>
    <section className="gambit-big-idea"><h3>The key idea</h3><p><NotationText text={briefing.idea}/></p></section>
    <div className="gambit-idea-stages">{illustrations.map(stage=><section className="gambit-idea-stage" key={stage.title}><h3>{stage.title}</h3><GambitMoveDiagram move={stage.move} side={side} theme={theme}/><p><NotationText text={stage.text}/></p></section>)}</div>
    <section className="gambit-plan-comparison"><div><h3>What the gambit player wants</h3><p><NotationText text={briefing.attack}/></p></div><div><h3>What the defender should watch for</h3><p><NotationText text={briefing.defense}/></p></div></section>
  </section><aside className="gambit-briefing-panel" aria-label="Explanation controls">
    <h3>Your role: {role} ({side==="w"?"White":"Black"})</h3>
    <p>{role==="Gambit player"?"You are playing the side offering the gambit. Stockfish will play its opponent.":"You are defending against the gambit. Stockfish will play the side offering it."}</p>
    <p>You can swap sides to {role==="Gambit player"?"try defending against the gambit instead":"try offering the gambit yourself"}. Swapping sides starts this scenario again.</p>
    <div className="gambit-briefing-actions"><button className="gambit-play-button" onClick={beginTraining}><Play size={18} aria-hidden="true"/>Play</button><button onClick={()=>start(selected,scenario,side==="w"?"b":"w")}><Repeat2 size={18} aria-hidden="true"/>{role==="Gambit player"?"Swap sides to defend":"Swap sides to play the gambit"}</button><button onClick={()=>{setSelected(null);setPgn("");setFrom(null);setPromotionMove(null);setPremoves([]);}}><LayoutGrid size={18} aria-hidden="true"/>All gambits</button><button onClick={onClose}><ArrowLeft size={18} aria-hidden="true"/>Back to arcade</button></div>
  </aside></div> : <>

  <div className="gambit-arena">
    <BoardPanel className="gambit-controls gambit-side-panel" aria-label="Gambit controls">
      <h2>Your training</h2>
      <div className="gambit-navigation"><button onClick={()=>{setSelected(null);setPgn("");setFrom(null);setPromotionMove(null);setPremoves([]);}}>All gambits</button><button onClick={onClose}>Back to arcade</button></div>
      <p className="gambit-role"><strong>Your role: {role} ({side==="w"?"White":"Black"})</strong><br/>Swap sides to {role==="Gambit player"?"practice defending against this gambit":"offer the gambit yourself"}.</p>
      {guidedMove&&<p className="gambit-move-key"><span className="gambit-from-key">From <NotationToken token={guidedMove.from}/></span><span aria-hidden="true"> &rarr; </span><span className="gambit-to-key">To <NotationToken token={guidedMove.to}/></span></p>}
      <p>{practice?"Play against Stockfish with move guidance":`Guided move ${Math.min(ply,line.length)} / ${line.length}`}</p>
      {selected.scenarios.length > 1 && <label>Scenario<select value={scenario} onChange={e=>start(selected,Number(e.target.value),side)}>{selected.scenarios.map((item,index)=><option key={item.pgn} value={index}>{cleared(selected,index)?"[cleared] ":""}{index+1}. {item.name}</option>)}</select></label>}
      <p>{selected.scenarios.length > 1 && `${selected.scenarios.filter((_,index)=>cleared(selected,index)).length} / ${selected.scenarios.length} cleared`}{selected.scenarios.every((_,index)=>cleared(selected,index)) ? " MASTERED" : ""}</p>
      <div className="gambit-actions"><button onClick={()=>start(selected,scenario,side)}>Restart scenario</button><button onClick={()=>start(selected,scenario,side==="w"?"b":"w")}>Train the other side</button><button onClick={()=>{setBriefingOpen(true);setBusy(false);setFrom(null);}}>Review gambit idea</button></div>
      <PremoveControl moves={premoves} onCancel={()=>{setPremoves([]);setFrom(null);setPromotionMove(null);}}/>
      {done&&!practice&&<div className="gambit-actions"><button onClick={()=>{setPractice(true);setFeedback("");}}>Play on against Stockfish</button>{scenario+1<selected.scenarios.length&&<button onClick={()=>start(selected,scenario+1,side)}>Next scenario</button>}</div>}
      <h3>Moves played</h3><p className="gambit-history"><NotationText text={game.history().join(" ")||"Starting position"}/></p>
      {briefing&&<section className="gambit-key-ideas" aria-label="Key gambit ideas"><h3>Key ideas</h3><p><NotationText text={briefing.idea}/></p><h4>Your plan</h4><p><NotationText text={role==="Gambit player"?briefing.attack:briefing.defense}/></p><h4>Watch for</h4><p><NotationText text={role==="Gambit player"?briefing.defense:briefing.attack}/></p></section>}
    </BoardPanel>
    <div className="gambit-board-column"><div className="gambit-board-frame"><div className="gambit-rank-axis" aria-hidden="true">{ranks.map(rank=><span key={rank}>{rank}</span>)}</div><div className="gambit-board chessboard" role="group" aria-label={`${side==="w"?"White":"Black"} training board`} onPointerDown={event=>{if(event.button===2){setPremoves([]);setFrom(null);}}}><BoardAnnotations color={side} positionKey={game.fen()} onCancelPremoves={()=>setPremoves([])}/>{ranks.flatMap(rank=>[...files].map(file=>{const square=`${file}${rank}` as Square;const piece=plannedBoard.get(square);const legal=targets.includes(square);return <BoardSquare key={square} square={square} piece={piece} theme={theme} canDrag={!game.isGameOver()&&!error&&(practice||!done)&&piece?.color===side&&!promotionMove} positionKey={`${selected.id}:${scenario}:${piece?.color}:${piece?.type}`} onPickUp={()=>setFrom(square)} onMovePiece={(origin,target,anchor)=>play(target,undefined,origin,false,anchor)} className={`square gambit-square ${(file.charCodeAt(0)+rank)%2?"square-light light":"square-dark dark"} ${from===square?"selected square-selected":""} ${lastMove?.from===square?"last-move last-move-from square-last square-last-from":""} ${lastMove?.to===square?"last-move last-move-to square-last square-last-to":""} ${legal?"legal square-target":""} ${legal&&queuingPremove?"square-premove-target":""} ${premoves.some(move=>move.from===square)?"square-premove-from":""} ${premoves.some(move=>move.to===square)?"square-premove-to":""} ${guidedMove?.from===square?"hint-from":""} ${guidedMove?.to===square?"hint-to":""}`} data-capture={legal&&!!piece?"true":undefined} aria-label={`${square}${piece?` ${piece.color==="w"?"white":"black"} ${piece.type}`:" empty"}`} aria-pressed={from===square} disabled={game.isGameOver()||!!error||(!practice&&done)||!!promotionMove} onClick={event=>{if(from&&targets.includes(square)){play(square,undefined,from,false,{x:event.clientX,y:event.clientY});return;}setFrom(piece?.color===side&&from!==square?square:null);}}/>;}))}</div><div className="gambit-file-axis" aria-hidden="true">{[...files].map(file=><span key={file}>{file}</span>)}</div></div></div>
    <BoardPanel className="gambit-coach gambit-side-panel" aria-label="Boss coaching">
      {boss&&<img src={bossThumbnail(boss.folder,__BOSS_PORTRAITS__)} alt={`${selected.name} boss`} />}
      <h2>Your gambit coach</h2><p className="gambit-note">{selected.name} Sentinel</p>
      <label><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/> Speak coaching aloud</label>
      {event&&<div className={`gambit-event gambit-event-${event.phase}`} role="status" aria-live="polite" aria-atomic="true"><strong>{event.label}</strong><p><NotationText text={event.detail}/></p></div>}
      <p className="gambit-speech" aria-live="polite">{game.isGameOver()?`Game over: ${game.isCheckmate()?"checkmate":`draw: ${game.drawReason()}`}. Restart to try again.`:<NotationText text={message}/>}</p>
      {practice&&currentHint?.error&&<div role="alert"><p>{currentHint.error}</p><button onClick={()=>setHintRetry(value=>value+1)}>Retry move guidance</button></div>}
      {busy&&<p role="status">Stockfish is thinking...</p>}{error&&<div role="alert"><p>{error}</p><button onClick={()=>setRetry(value=>value+1)}>Retry Stockfish</button></div>}
      {done&&!practice&&outcome&&<section className="gambit-outcome" aria-labelledby="gambit-outcome-title"><h3 id="gambit-outcome-title">Gambit played. What comes next?</h3><h4>The position you reached</h4><p><NotationText text={outcome.material}/></p><h4>Why try this gambit?</h4><p><NotationText text={outcome.benefit}/></p><h4>Your next plan</h4><p><NotationText text={outcome.next}/></p><h4>What to expect from your opponent</h4><p><NotationText text={outcome.opponent}/></p><p>{outcome.transition}</p></section>}
    </BoardPanel>
  </div>{promotionMove&&<PromotionMenu position={promotionMove.position} color={side} theme={theme} onCancel={()=>{setPromotionMove(null);setPremoves([]);}} onChoose={piece=>{const pending=promotionMove;setPromotionMove(null);play(pending.to,piece,pending.from,true,pending.position);}}/>}</>}</>}
 </section>;
}
