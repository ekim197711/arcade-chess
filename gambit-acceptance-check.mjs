import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
const server=await createServer({server:{watch:null}});
try{
 const {acceptingGambitLine}=await server.ssrLoadModule('/src/gambitAcceptance.ts');
 const {Chess}=await server.ssrLoadModule('/src/chess.ts');
 let count=0;
 for(const g of JSON.parse(readFileSync('src/gambits.json','utf8')))for(const s of g.scenarios){
  const lesson=acceptingGambitLine(g.name,g.scenarios[0].pgn,s.pgn);assert(lesson.accepted,s.name);assert(lesson.acceptancePly>0,s.name);assert(lesson.line[lesson.acceptancePly-1].captured,s.name);assert.notEqual(lesson.line[lesson.acceptancePly-1].color,lesson.offering,s.name);
  const replay=new Chess();for(const m of lesson.line)assert(replay.move(m.san));assert(lesson.line.some(m=>m.captured&&m.color!==lesson.offering),s.name);count++;
 }
 const king=acceptingGambitLine("King's Gambit",'1. e4 e5 2. f4','1. e4 e5 2. f4 Bc5');assert.equal(king.line.at(-1).san,'exf4');assert(king.adapted);
 const queen=acceptingGambitLine("Queen's Gambit",'1. d4 d5 2. c4','1. d4 d5 2. c4 e6');assert.equal(queen.line.at(-1).san,'dxc4');
 const accepted=acceptingGambitLine("King's Gambit",'1. e4 e5 2. f4','1. e4 e5 2. f4 exf4 3. Nf3');assert.equal(accepted.line.at(-1).san,'Nf3');assert(!accepted.adapted);
 console.log(`PASS ${count} legal accepting lessons, forced King's/Queen's acceptance, retained accepted continuations`);
}finally{await server.close();}
