import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
const server=await createServer({server:{watch:null}});
try{
 const {acceptingGambitLine}=await server.ssrLoadModule('/src/gambitAcceptance.ts');
 const {gambitIllustrations}=await server.ssrLoadModule('/src/gambitIllustrations.ts');
 const {Chess}=await server.ssrLoadModule('/src/chess.ts');
 let positions=0;
 for(const g of JSON.parse(readFileSync('src/gambits.json','utf8')))for(const source of g.scenarios){const lesson=acceptingGambitLine(g.name,g.scenarios[0].pgn,source.pgn);const stages=gambitIllustrations(lesson);assert(stages.length>=2);for(const stage of stages){const game=new Chess(stage.move.before);game.move(stage.move.san);assert.equal(game.fen(),stage.move.after);positions++;}}
 const king=acceptingGambitLine("King's Gambit",'1. e4 e5 2. f4','1. e4 e5 2. f4');assert.deepEqual(gambitIllustrations(king).map(stage=>stage.move.san),['f4','exf4','Nf3']);
 console.log(`PASS ${positions} legal briefing diagrams across all lessons, including f4, exf4 and Nf3 for King's Gambit`);
}finally{await server.close();}
