import { Chess, type Move, type Color } from "./chess";
import { gambitBriefing } from "./gambitBriefing";

function load(pgn:string) { const game=new Chess();game.loadPgn(pgn);return game; }
/** Keep catalogue replies only when they accept the named offer; otherwise branch into a legal capture. */
export function acceptingGambitLine(name:string,basePgn:string,sourcePgn:string): {line: Move[]; pgn:string; accepted:boolean; adapted:boolean; offering:Color; acceptancePly:number} {
 const base=load(basePgn), source=load(sourcePgn);
 const offering=gambitBriefing(name,basePgn).offeringSide;
 const sourceMoves=source.history({verbose:true}), baseMoves=base.history({verbose:true});
 const positionKey=(fen:string)=>fen.split(' ').slice(0,4).join(' ');
 let boundary=sourceMoves.findIndex(move=>positionKey(move.after)===positionKey(base.fen()))+1;
 if(!boundary) boundary=sourceMoves.length;
 const game=new Chess(sourceMoves[0]?.before);for(const move of sourceMoves.slice(0,boundary))game.move(move.san);
 let adapted=false, accepted=false, acceptancePly=0;
 const captures=()=>game.turn()!==offering?game.moves({verbose:true}).filter(move=>!!move.captured):[];
 let candidates=captures();
 // These catalogue entries name an early setup before a sacrifice is possible.
 const bridge = name === "Zukertort Opening: Queen's Gambit" ? ["d4","d5","c4"] : /Flohr-Mikenas-Carls Variation, Nei Gambit/.test(name) ? ["d4"] : [];
 if(!candidates.length&&bridge.length){for(const san of bridge)game.move(san);candidates=captures();adapted=true;}
 if(candidates.length){
  const book=sourceMoves[boundary];
  const preferred=candidates.find(move=>move.to===baseMoves.at(-1)?.to)??candidates.find(move=>move.san===book?.san)??candidates[0];
  game.move(preferred.san);accepted=true;acceptancePly=game.history().length;
  if(!adapted&&book?.san===preferred.san){for(const move of sourceMoves.slice(boundary+1))game.move(move.san);}
  else adapted=true;
 } else {
  // Already-accepted gambits can finish with development by either side.
  for(let i=boundary-1;i>=0;i--)if(sourceMoves[i].color!==offering&&sourceMoves[i].captured){acceptancePly=i+1;break;}
  accepted=acceptancePly>0;
  for(const move of sourceMoves.slice(boundary))game.move(move.san);
 }
 if(!accepted){
  for(let i=sourceMoves.length-1;i>=0;i--){
   if(sourceMoves[i].color===offering)continue;
   const branch=load(sourcePgn);while(branch.history().length>i)branch.undo();
   const capture=branch.moves({verbose:true}).find(move=>!!move.captured&&move.to===sourceMoves[i-1]?.to);
   if(capture){branch.move(capture.san);return {line:branch.history({verbose:true}),pgn:branch.pgn(),accepted:true,adapted:true,offering,acceptancePly:branch.history().length};}
  }
 }
 if(!accepted&&sourcePgn!==basePgn){
  const fallback=acceptingGambitLine(name,basePgn,basePgn);
  return {...fallback,adapted:true};
 }
 return {line:game.history({verbose:true}),pgn:game.pgn(),accepted,adapted,offering,acceptancePly};
}
