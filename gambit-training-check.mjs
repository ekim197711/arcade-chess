import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
const catalog=JSON.parse(readFileSync('src/gambits.json','utf8'));
const ids=new Set();let total=0;
for(const g of catalog){assert(!ids.has(g.id));ids.add(g.id);assert(g.scenarios.length);for(const s of g.scenarios){const game=new Chess();game.loadPgn(s.pgn);assert(game.history().length>0);const replay=new Chess();for(const m of game.history({verbose:true})){assert(replay.moves().includes(m.san));replay.move(m.san);}assert.equal(replay.fen(),game.fen());total++;}}
console.log(`PASS ${catalog.length} distinct gambits, ${total} legal replayable scenarios`);
