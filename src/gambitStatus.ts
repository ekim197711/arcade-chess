import { Chess, type Move, type Color } from "./chess";

type Lesson = {line:Move[]; offering:Color; acceptancePly:number};
export type GambitStatus = {phase:"offered"|"accepted"|"declined";label:string;detail:string};
const PIECES={p:"pawn",n:"knight",b:"bishop",r:"rook",q:"queen",k:"king"};
/** Report only the designated sacrifice, never an unrelated opening capture. */
export function gambitStatus(history:Move[],lesson:Lesson,player:Color):GambitStatus|null {
 const expected=lesson.line[lesson.acceptancePly-1];
 if(!expected?.captured||history.length<lesson.acceptancePly-1)return null;
 const positionKey=(fen:string)=>fen.split(" ").slice(0,4).join(" ");
 const actual=history[lesson.acceptancePly-1];
 const offeringPlayer=player===lesson.offering;
 const piece=PIECES[expected.captured];
 if(actual){
  if(positionKey(actual.before)!==positionKey(expected.before))return null;
  const took=actual.color!==lesson.offering&&actual.to===expected.to&&actual.captured===expected.captured;
  if(took)return {phase:"accepted",label:offeringPlayer?"Your opponent took the gambit!":"You accepted the gambit!",detail:`${actual.san} captured the offered ${piece}. ${offeringPlayer?"You now need to use your activity to justify the sacrifice.":"Now complete your development and watch for the opponent's attacking ideas."}`};
  return {phase:"declined",label:offeringPlayer?"Opponent declined the gambit!":"You declined the gambit!",detail:`${actual.san} did not capture the offered ${piece}. The offer was declined on this move; the position may still contain pawn tension or another chance to accept later.`};
 }
 const current=history.at(-1)?.after??new Chess().fen();
 if(positionKey(current)!==positionKey(expected.before))return null;
 return {phase:"offered",label:offeringPlayer?`You are offering a "free" ${piece}!`:`Your opponent is offering a "free" ${piece}!`,detail:`${offeringPlayer?"Your opponent can":"You can"} accept with ${expected.san}. "Free" means material is being offered deliberately in return for activity or other compensation; taking it can have consequences.`};
}
