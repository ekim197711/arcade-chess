import { Chess, type Move, type Color, type Square } from "./chess";

type Lesson = {line:Move[];acceptancePly:number;offering:Color};
export type GambitIllustration = {title:string;text:string;move:Move};
export const GAMBIT_ILLUSTRATED_MOVES=9;
const names={p:"pawn",n:"knight",b:"bishop",r:"rook",q:"queen",k:"king"};
export function gambitIllustrations(lesson:Lesson):GambitIllustration[] {
 const capture=lesson.line[lesson.acceptancePly-1];
 if(!capture?.captured)return [];
 const setup=lesson.line[lesson.acceptancePly-2];
 const offering=lesson.offering==="w"?"White":"Black";
 const defender=lesson.offering==="w"?"Black":"White";
 const square=(capture.flags.includes("e")?capture.to[0]+capture.from[1]:capture.to) as Square;
 const diagrams:GambitIllustration[]=[];
 if(setup)diagrams.push({title:"1. Create the offer",move:setup,text:`${offering} has played ${setup.san}. The ${names[capture.captured]} on ${square} is available to capture with ${capture.san}. The point is to invite the opponent to spend time taking material while you prepare active play.`});
 diagrams.push({title:"2. See what acceptance changes",move:capture,text:`${defender} plays ${capture.san}, taking the offered ${names[capture.captured]}. ${offering} must now make use of development, central control or open lines. The material has a cost: the activity must be used before the defender catches up.`});
 const position=new Chess(capture.after);
 const book=lesson.line[lesson.acceptancePly];
 const homeRank=lesson.offering==="w"?"1":"8";
 const legal=position.moves({verbose:true});
 const follow=book??legal.find(move=>!!move.captured&&move.to===capture.to&&(move.piece==="n"||move.piece==="b"))??legal.find(move=>move.san.startsWith("O-O"))??legal.find(move=>move.piece==="n"&&move.from[1]===homeRank&&move.to===(lesson.offering==="w"?"f3":"f6"))??legal.find(move=>move.piece==="n"&&move.from[1]===homeRank&&move.to===(lesson.offering==="w"?"c3":"c6"))??legal.find(move=>(move.piece==="n"||move.piece==="b")&&move.from[1]===homeRank);
 if(follow){
  const action=follow.san.startsWith("O-O")?"shelters the king and brings a rook closer to the centre":`brings the ${names[follow.piece]} from ${follow.from} to ${follow.to}`;
  diagrams.push({title:"3. Put the activity to work",move:follow,text:`One possible follow-up is ${follow.san}: ${action}. Look for moves that develop pieces or create useful threats. This is an illustration of the plan, not a forced continuation; your opponent's reply will matter.`});
 }
 // Continue the same position, using the scenario line before illustrative replies.
 if(follow)position.move(follow.san);
 let nextPly=lesson.acceptancePly+(follow?1:0);
 while(diagrams.length<GAMBIT_ILLUSTRATED_MOVES&&!position.isGameOver()){
  const bookMove=lesson.line[nextPly];
  const move=bookMove??illustrativeReply(position);
  if(!move)break;
  const played=position.move(move.san);
  const color=played.color==="w"?"White":"Black";
  const isOffering=played.color===lesson.offering;
  const action=played.san.startsWith("O-O")?"castles, moving the king toward safety and connecting the rooks":played.captured?`captures the ${names[played.captured]} on ${played.to} with the ${names[played.piece]}`:played.piece==="p"?`moves the pawn from ${played.from} to ${played.to}, changing the pawn structure`:`moves the ${names[played.piece]} from ${played.from} to ${played.to}`;
  const focus=isOffering?"Compare your remaining material with your piece activity. Look for development and useful pressure before committing to another attack.":"The defender also gets time to improve the position. Check what this reply changes before continuing your own plan.";
  diagrams.push({title:`${diagrams.length+1}. ${isOffering?"Continue the gambit plan":"Consider the defender's reply"}`,move:played,text:`${bookMove?"In this scenario":"In this illustrative continuation"}, ${color} plays ${played.san} and ${action}.${played.san.endsWith("#")?" This gives checkmate.":played.san.endsWith("+")?" This gives check: the opponent must answer it.":""} ${focus}${!bookMove?" This is one legal example, not a forced or engine-verified line.":""}`});
  nextPly++;
 }
 // If the example ends early (for instance in mate), show more of its setup.
 let contextPly=lesson.acceptancePly-3;
 while(diagrams.length<GAMBIT_ILLUSTRATED_MOVES&&contextPly>=0){
  const move=lesson.line[contextPly--];
  diagrams.unshift({title:"Prepare the position",move,text:`${move.color==="w"?"White":"Black"} plays ${move.san}, moving the ${names[move.piece]} from ${move.from} to ${move.to}. This is the position leading into the offer; follow how both sides arrange their pieces before the capture.`});
 }
 return diagrams.map((stage,index)=>({...stage,title:`${index+1}. ${stage.title.replace(/^\d+\. /,"")}`}));
}

const illustrationCache=new Map<string,string>();

/** Prefer development and central play while avoiding immediate material loss. */
function illustrativeReply(position:Chess):Move|undefined {
 const key=position.fen(), legal=position.moves({verbose:true}), cached=illustrationCache.get(key);
 if(cached)return legal.find(move=>move.san===cached);
 const value={p:100,n:320,b:330,r:500,q:900,k:20000};
 const score=(move:Move)=>{
  const next=new Chess(move.after);
  const home=move.color==="w"?"1":"8";
  const central=7-Math.abs(3.5-(move.to.charCodeAt(0)-97))-Math.abs(3.5-(Number(move.to[1])-1));
  const risk=Math.max(0,...next.moves().map(san=>{const target=san.match(/x([a-h][1-8])/);if(!target)return 0;const victim=next.get(target[1] as Square);return victim?value[victim.type]:value.p;}));
  return (next.isCheckmate()?100000:0)+(move.captured?value[move.captured]:0)-risk+central*3+((move.piece==="n"||move.piece==="b")&&move.from[1]===home?35:0)+(move.san.startsWith("O-O")?45:0)-(move.piece==="k"&&!move.san.startsWith("O-O")?25:0);
 };
 const chosen=legal.map(move=>({move,score:score(move)})).sort((a,b)=>b.score-a.score)[0]?.move;
 if(chosen){illustrationCache.set(key,chosen.san);if(illustrationCache.size>2048)illustrationCache.delete(illustrationCache.keys().next().value!);}
 return chosen;
}
