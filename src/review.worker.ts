import { Chess } from "./chess";
import { analyzeMove } from "./bot";

self.onmessage = (event: MessageEvent<string>) => {
  try {
    const game = new Chess();
    game.loadPgn(event.data);
    const moves = game.history({ verbose: true });
    moves.forEach((move, index) => {
      self.postMessage({ index, analysis: analyzeMove(move.before, move.san) });
    });
    self.postMessage({ done: true });
  } catch {
    self.postMessage({ error: true });
  }
};
