import { Chess } from "./chess";
import { analyzeMove } from "./bot";

// Final and alternative positions may not occur in the game's move analysis.
self.onmessage = (event: MessageEvent<string>) => {
  const fen = event.data;
  try {
    const position = new Chess(fen);
    const first = position.isGameOver() ? undefined : position.moves()[0];
    const san = first ? analyzeMove(fen, first).suggested : null;
    self.postMessage({ fen, san });
  } catch { self.postMessage({ fen, san: null }); }
};
