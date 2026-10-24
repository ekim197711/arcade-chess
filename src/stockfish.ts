import { Chess, type Square } from "./chess";

export const STOCKFISH_ELO_RANGE = { min: 1320, max: 3190 };
export type EngineMove = { from: Square; to: Square; promotion?: string };
type EloRange = { min: number; max: number };

export function stockfishStrength(elo: number, range: EloRange = STOCKFISH_ELO_RANGE) {
  if (!Number.isFinite(elo)) throw new Error("Invalid boss Elo");
  const requestedElo = Math.round(elo);
  return { requestedElo, engineElo: Math.max(range.min, Math.min(range.max, requestedElo)), beginner: requestedElo < range.min };
}

export function bossStrengthDescription(elo: number) {
  return elo < STOCKFISH_ELO_RANGE.min
    ? `Target ${elo} Elo: approximate beginner strength using Stockfish with additional mistakes.`
    : `Stockfish target: ${elo} Elo. Engine ratings are estimates, not official human ratings.`;
}

const cleanFen = (fen: string) => fen.replace(/ chess960$/, "");

export function stockfishPosition(pgn: string, fen: string) {
  const game = new Chess();
  game.loadPgn(pgn);
  if (game.fen() !== fen) throw new Error("Engine position does not match the game");
  const moves = game.history({ verbose: true });
  const initial = cleanFen(moves[0]?.before ?? fen);
  return `position fen ${initial}${moves.length ? ` moves ${moves.map(move => move.from + move.to + (move.promotion ?? "")).join(" ")}` : ""}`;
}

/** Sample only Stockfish-evaluated moves for ratings below its native Elo floor. */
export function beginnerMove(best: string, candidates: Map<string, number>, elo: number, minimum: number, random = Math.random): string {
  const weakness = Math.max(0, Math.min(1, (minimum - elo) / (minimum - 100)));
  if (random() >= weakness * .95 || candidates.size === 0) return best;
  const entries = [...candidates];
  const maximum = Math.max(...entries.map(([, score]) => score));
  const temperature = Math.max(20, weakness * 600);
  const weights = entries.map(([, score]) => Math.exp(Math.max(-50, (score - maximum) / temperature)));
  let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < entries.length; index++) {
    ticket -= weights[index];
    if (ticket <= 0) return entries[index][0];
  }
  return best;
}

export function requestStockfishMove(fen: string, pgn: string, elo: number, signal: AbortSignal): Promise<EngineMove | null> {
  const position = new Chess(fen);
  if (position.isGameOver()) return Promise.resolve(null);
  const positionCommand = stockfishPosition(pgn, fen);
  const legalMoves = position.moves({ verbose: true });
  const legal = new Map(legalMoves.map(move => [move.from + move.to + (move.promotion ?? ""), move]));
  return new Promise((resolve, reject) => {
    const worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`);
    let settled = false;
    let stage: "uci" | "ready" | "search" = "uci";
    let range: EloRange | undefined;
    let limitStrengthSupported = false;
    let strength = stockfishStrength(elo);
    const candidates = new Map<string, number>();
    let timer: ReturnType<typeof setTimeout>;
    const finish = (move: EngineMove | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(move);
    };
    const abort = () => finish(null, new DOMException("Engine search cancelled", "AbortError"));
    const timeout = () => finish(null, new Error("Stockfish did not respond. Please retry."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    timer = setTimeout(timeout, 30000);
    worker.onerror = () => finish(null, new Error("Stockfish could not load. Please retry."));
    worker.onmessage = (event: MessageEvent<string>) => {
      for (const line of String(event.data).split(/\r?\n/)) {
        if (settled) return;
        if (stage === "uci") {
          const option = line.match(/^option name UCI_Elo type spin .* min (\d+) max (\d+)/);
          if (option) range = { min: Number(option[1]), max: Number(option[2]) };
          if (line.startsWith("option name UCI_LimitStrength type check")) limitStrengthSupported = true;
          if (line === "uciok") {
            if (!range || !limitStrengthSupported) {
              finish(null, new Error("Stockfish Elo controls are unavailable."));
              return;
            }
            strength = stockfishStrength(elo, range);
            worker.postMessage("ucinewgame");
            worker.postMessage("setoption name Hash value 16");
            worker.postMessage(`setoption name UCI_Chess960 value ${position.mode === "freestyle"}`);
            worker.postMessage("setoption name UCI_LimitStrength value true");
            worker.postMessage(`setoption name UCI_Elo value ${strength.engineElo}`);
            worker.postMessage(`setoption name MultiPV value ${strength.beginner ? legalMoves.length : 1}`);
            stage = "ready";
            worker.postMessage("isready");
          }
        } else if (stage === "ready" && line === "readyok") {
          stage = "search";
          clearTimeout(timer);
          timer = setTimeout(timeout, 20000);
          worker.postMessage(positionCommand);
          worker.postMessage(strength.beginner ? "go depth 4" : "go movetime 1500");
        } else if (stage === "search") {
          const info = line.match(/\bscore (cp|mate) (-?\d+).*\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (info && legal.has(info[3])) candidates.set(info[3], info[1] === "mate" ? Math.sign(Number(info[2])) * 100_000 : Number(info[2]));
          const best = line.match(/^bestmove (\S+)/);
          if (best) {
            const uci = strength.beginner ? beginnerMove(best[1], candidates, strength.requestedElo, range!.min) : best[1];
            const move = legal.get(uci);
            if (!move) { finish(null, new Error("Stockfish returned an invalid move. Please retry.")); return; }
            finish({ from: move.from, to: move.to, promotion: move.promotion });
          }
        }
      }
    };
    worker.postMessage("uci");
  });
}
