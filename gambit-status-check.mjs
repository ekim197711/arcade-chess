import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({server:{watch:null}});
try{
 const {gambitStatus}=await server.ssrLoadModule('/src/gambitStatus.ts');
 const {acceptingGambitLine}=await server.ssrLoadModule('/src/gambitAcceptance.ts');
 const {Chess}=await server.ssrLoadModule('/src/chess.ts');
 const history=pgn=>{const game=new Chess();if(pgn)game.loadPgn(pgn);return game.history({verbose:true});};
 const lesson=acceptingGambitLine("King's Gambit",'1. e4 e5 2. f4','1. e4 e5 2. f4');
 assert.equal(gambitStatus(history('1. e4 e5'),lesson,'w'),null);
 assert.equal(gambitStatus(history('1. e4 e5 2. f4'),lesson,'w').label,'You are offering a "free" pawn!');
 assert.equal(gambitStatus(history('1. e4 e5 2. f4'),lesson,'b').label,'Your opponent is offering a "free" pawn!');
 assert.equal(gambitStatus(history('1. e4 e5 2. f4 exf4'),lesson,'w').label,'Your opponent took the gambit!');
 assert.equal(gambitStatus(history('1. e4 e5 2. f4 exf4'),lesson,'b').label,'You accepted the gambit!');
 assert.equal(gambitStatus(history('1. e4 e5 2. f4 Bc5'),lesson,'w').label,'Opponent declined the gambit!');
 assert.equal(gambitStatus(history('1. e4 e5 2. f4 Bc5'),lesson,'b').label,'You declined the gambit!');
 assert.equal(gambitStatus(history('1. e4 d5 2. exd5 Qxd5'),lesson,'w'),null,'unrelated captures are not gambit acceptance');
 const knight=history('1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Nxe5 Nxe5');
 assert.match(gambitStatus(knight.slice(0,-1),{line:knight,offering:'w',acceptancePly:8},'w').label,/free.*knight/);
 assert.equal(gambitStatus(history('1. e4 e5 2. f4 exf4 3. Nf3'),lesson,'w').phase,'accepted');
 console.log('PASS offered/accepted/declined messages for both roles, non-pawn sacrifices, unrelated captures and persistent acceptance');
}finally{await server.close();}
