import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server=await createServer({server:{watch:null}});
try {
 const {gambitOutcome}=await server.ssrLoadModule('/src/gambitOutcome.ts');
 const base='1. e4 e5 2. f4';
 const equal=gambitOutcome("King's Gambit",base,base,'w');assert.match(equal.material,/currently equal/);assert.match(equal.next,/Black moves next/);assert.match(equal.next,/Develop quickly/);
 const accepted=gambitOutcome("King's Gambit",base,'1. e4 e5 2. f4 exf4 3. Nf3','w');assert.match(accepted.material,/1 pawn-point behind/);assert.match(accepted.material,/f file/);assert.match(accepted.next,/b1, c1, f1/);assert.doesNotMatch(accepted.next,/g1/);
 const defender=gambitOutcome("King's Gambit",base,'1. e4 e5 2. f4 exf4','b');assert.match(defender.next,/White moves next/);assert.match(defender.next,/Develop calmly/);assert.match(defender.opponent,/gambit player/);
 const mate=gambitOutcome("King's Gambit",base,'1. f3 e5 2. g4 Qh4#','w');assert.match(mate.next,/checkmate/);assert.match(equal.benefit,/does not prove an advantage/);
 console.log('PASS completion material balance, open files, next side, remaining development, defender plans, terminal positions and honest benefits');
} finally {await server.close();}
