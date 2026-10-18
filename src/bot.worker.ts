import { chooseBotMove } from "./bot";

self.addEventListener("message", (event: MessageEvent<{ fen: string; elo: number }>) => {
  const move = chooseBotMove(event.data.fen, event.data.elo);
  self.postMessage({
    move: move ? { from: move.from, to: move.to, promotion: move.promotion } : null,
  });
});

export {};
