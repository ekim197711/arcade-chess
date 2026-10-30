import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ server: { watch: null } });
try {
  const { fallbackBotReaction } = await vite.ssrLoadModule('/src/fallbackBotReactions.ts');
  const { Chess } = await vite.ssrLoadModule('/src/chess.ts');
  const game = (pgn, extra = {}) => {
    const board = new Chess();
    if (pgn) board.loadPgn(pgn);
    return { is_bot:true, result:null, pgn, ply_count:board.history().length, ...extra };
  };
  assert.equal(fallbackBotReaction(game('1. e4'),0),null);
  assert.equal(fallbackBotReaction(game('1. e4 d5 2. exd5',{is_bot:false}),0),null);
  assert.equal(fallbackBotReaction(game('1. e4 d5 2. exd5'),3),null,'heartbeats do not replay a reaction');
  const captured = fallbackBotReaction(game('1. e4 d5 2. exd5'),2);
  assert.equal(captured.emoji,'😠'); assert.match(captured.message,/my pawn/);
  const botCapture = fallbackBotReaction(game('1. e4 d5 2. exd5 Qxd5'),3);
  assert.equal(botCapture.emoji,'👍'); assert.match(botCapture.message,/your pawn/);
  const queenCapture = fallbackBotReaction(game('1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+ 4. Be2 Qxe2+ 5. Ngxe2'),8);
  assert.equal(queenCapture.emoji,'😮'); assert.match(queenCapture.message,/my queen/);
  const check = fallbackBotReaction(game('1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+'),5);
  assert.equal(check.emoji,'👍'); assert.equal(check.message,'Check!');
  const playerCheck = fallbackBotReaction(game('1. e4 d5 2. Bb5+'),2);
  assert.equal(playerCheck.emoji,'😮');
  const castle = fallbackBotReaction(game('1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O'),6);
  assert.equal(castle.emoji,'👍'); assert.match(castle.message,/castling/);
  const promotionBoard = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'); promotionBoard.move('a8=Q+');
  assert.match(fallbackBotReaction(game(promotionBoard.pgn()),0).message,/promotion/);
  const mate = game('1. f3 e5 2. g4 Qh4#',{result:'0-1'});
  assert.equal(fallbackBotReaction(mate,3).emoji,'👏');
  assert.equal(fallbackBotReaction({...mate,result:'1-0'},4).message,'You got me. Well played!');
  assert.equal(fallbackBotReaction({...mate,result:'1/2-1/2'},4).emoji,'🤝');
  console.log('Bot reaction rules passed: quiet moves, both sides captures/checks, queen loss, castling, promotion, results and duplicate polls.');
} finally { await vite.close(); }
