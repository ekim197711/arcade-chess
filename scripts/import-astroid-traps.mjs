import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parsePgn} from 'chessops/pgn';
import {Chess} from 'chess.js';
import {CLASSIC_GAMES,classicPgn} from '../src/classicGames.ts';
const url='https://lichess.org/study/vVn62TRB.pgn';
const cache=new URL('../.tmp/astroid-traps.pgn',import.meta.url);
await mkdir(new URL('../.tmp/',import.meta.url),{recursive:true});
let raw;try{raw=await readFile(cache,'utf8');}catch{const response=await fetch(url);if(!response.ok)throw new Error('Could not fetch trap study');raw=await response.text();await writeFile(cache,raw);}
const candidates=[];
for(const entry of parsePgn(raw)){
 const board=new Chess();
 for(const node of entry.moves.mainline())board.move(node.san);
 if(!board.isCheckmate())continue;
 candidates.push({title:entry.headers.get('ChapterName').replace(/^@IM Eric Rosen /,''),moves:board.history(),source:entry.headers.get('ChapterURL')});
}
candidates.push(
 {title:"Scholar's Mate",moves:['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#'],source:'https://en.wikipedia.org/wiki/Scholar%27s_mate'},
 {title:"Légal's Mate",moves:['e4','e5','Nf3','d6','Bc4','Bg4','Nc3','g6','Nxe5','Bxd1','Bxf7+','Ke7','Nd5#'],source:'https://en.wikipedia.org/wiki/Legal_Trap'},
 ...CLASSIC_GAMES.filter(game=>game.id!=='immortal-1851').map(game=>{const board=new Chess();board.loadPgn(classicPgn(game));return{title:`${game.title} mating net`,moves:board.history(),source:game.source};}),
);
candidates.sort((a,b)=>a.moves.length-b.moves.length);
const puzzles=candidates.map((entry,index)=>{
 const board=new Chess();for(const san of entry.moves.slice(0,-1))board.move(san);
 const solutions=board.moves({verbose:true}).filter(move=>{const trial=new Chess(board.fen());trial.move(move);return trial.isCheckmate();}).map(move=>({from:move.from,to:move.to,promotion:move.promotion,san:move.san}));
 if(!solutions.length)throw new Error(`No mate in ${entry.title}`);
 return{id:`trap-${index+1}`,title:entry.title,fen:board.fen(),setupPgn:board.pgn(),side:board.turn(),solutions,source:entry.source};
});
if(puzzles.length!==18)throw new Error(`Expected 18 unique traps, got ${puzzles.length}`);
if(new Set(puzzles.map(p=>p.fen)).size!==18)throw new Error('Duplicate positions');
await writeFile(new URL('../src/astroidPuzzles.json',import.meta.url),JSON.stringify(puzzles,null,2)+'\n');
console.log(`Imported ${puzzles.length} verified mate-in-one trap positions, with all legal mating alternatives accepted. No study annotations copied.`);
