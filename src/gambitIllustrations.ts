import { Chess, type Move, type Color, type Square } from "./chess";

type Lesson = {line:Move[];acceptancePly:number;offering:Color};
export type GambitIllustration = {title:string;text:string;move:Move};
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
 return diagrams;
}
