import { useCallback, useRef, useState } from "react";
import { Chess, type Color, type Square } from "./chess";

export type PlannedMove = { from: Square; to: Square };

export function usePremoveQueue<T extends PlannedMove>() {
  const [premoves, update] = useState<T[]>([]);
  const current = useRef<T[]>([]);
  const consumedPosition = useRef("");
  const setPremoves = useCallback((value: T[] | ((previous: T[]) => T[])) => {
    current.current = typeof value === "function" ? value(current.current) : value;
    update(current.current);
  }, []);
  const takePremove = useCallback((position: string) => {
    if (!current.current.length || consumedPosition.current === position) return;
    consumedPosition.current = position;
    const [move, ...rest] = current.current;
    current.current = rest;
    update(rest);
    return move;
  }, []);
  return { premoves, setPremoves, takePremove };
}

// Preview only: advance our pieces without inventing the opponent's replies.
// Every queued move still goes through the real chess rules when executed.
export function premoveBoard(game: Chess, moves: readonly PlannedMove[], color: Color) {
  type Piece = NonNullable<ReturnType<Chess["get"]>>;
  const pieces = new Map<Square, Piece>();
  const castlingRights = game.fen().split(" ")[2];
  let kingMoved = false;
  const movedRooks = new Set<Square>();
  for (const row of game.board()) for (const piece of row) if (piece) pieces.set(piece.square, piece);
  const squareAt = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8 ? `${String.fromCharCode(97 + x)}${y + 1}` as Square : null;
  const targets = (from: Square): Square[] => {
    const piece = pieces.get(from);
    if (!piece || piece.color !== color) return [];
    const x = from.charCodeAt(0) - 97, y = Number(from[1]) - 1;
    const result: Square[] = [];
    const add = (dx: number, dy: number) => {
      const to = squareAt(x + dx, y + dy);
      if (to && pieces.get(to)?.color !== color) result.push(to);
    };
    if (piece.type === "p") {
      const direction = color === "w" ? 1 : -1;
      const forward = squareAt(x, y + direction);
      if (forward && !pieces.has(forward)) {
        result.push(forward);
        const twice = squareAt(x, y + 2 * direction);
        if (y === (color === "w" ? 1 : 6) && twice && !pieces.has(twice)) result.push(twice);
      }
      // An opponent's next move may make a capture or en passant possible.
      add(-1, direction); add(1, direction);
    } else if (piece.type === "n") {
      for (const [dx, dy] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) add(dx, dy);
    } else if (piece.type === "k") {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) add(dx, dy);
      const rank = color === "w" ? 0 : 7;
      if (y === rank && !kingMoved) for (const [rookSquare, rook] of pieces) {
        if (rook.type !== "r" || rook.color !== color || Number(rookSquare[1]) - 1 !== rank) continue;
        const rookX = rookSquare.charCodeAt(0) - 97, kingTarget = rookX > x ? 6 : 2, rookTarget = rookX > x ? 5 : 3;
        const right = rookX === 7 ? "K" : rookX === 0 ? "Q" : String.fromCharCode(65 + rookX);
        if (movedRooks.has(rookSquare) || !castlingRights.includes(color === "w" ? right : right.toLowerCase())) continue;
        if (game.mode === "standard" && (x !== 4 || (rookX !== 0 && rookX !== 7))) continue;
        const clear = (a: number, b: number) => {
          for (let file = Math.min(a,b); file <= Math.max(a,b); file++) {
            const square = squareAt(file, rank)!;
            if (square !== from && square !== rookSquare && pieces.has(square)) return false;
          }
          return true;
        };
        if (clear(x, kingTarget) && clear(rookX, rookTarget)) result.push(game.mode === "freestyle" ? rookSquare : squareAt(kingTarget, rank)!);
      }
    } else {
      const directions = piece.type === "b" ? [[1,1],[1,-1],[-1,1],[-1,-1]] : piece.type === "r" ? [[1,0],[-1,0],[0,1],[0,-1]] : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of directions) for (let step = 1; step < 8; step++) {
        const to = squareAt(x + dx * step, y + dy * step);
        if (!to) break;
        if (pieces.get(to)?.color !== color) result.push(to);
        if (pieces.has(to)) break;
      }
    }
    return result;
  };
  for (const move of moves) {
    const piece = pieces.get(move.from);
    if (!piece || piece.color !== color || !targets(move.from).includes(move.to)) break;
    const occupant = pieces.get(move.to);
    const castle = piece.type === "k" && (occupant?.color === color && occupant.type === "r" || game.mode === "standard" && Math.abs(move.to.charCodeAt(0) - move.from.charCodeAt(0)) === 2);
    if (castle) {
      const rank = move.from[1], kingside = move.to > move.from;
      const rookSquare = game.mode === "freestyle" ? move.to : `${kingside ? "h" : "a"}${rank}` as Square;
      const rook = pieces.get(rookSquare);
      pieces.delete(move.from); pieces.delete(rookSquare);
      pieces.set(`${kingside ? "g" : "c"}${rank}` as Square, piece);
      if (rook) pieces.set(`${kingside ? "f" : "d"}${rank}` as Square, rook);
    } else {
      if (piece.type === "p" && move.from[0] !== move.to[0] && !occupant) {
        const capturedSquare = `${move.to[0]}${move.from[1]}` as Square;
        const captured = pieces.get(capturedSquare);
        if (captured?.type === "p" && captured.color !== color) pieces.delete(capturedSquare);
      }
      pieces.delete(move.from);
      pieces.set(move.to, piece.type === "p" && (move.to[1] === "1" || move.to[1] === "8") ? { ...piece, type: "q" } : piece);
    }
    if (piece.type === "k") kingMoved = true;
    if (piece.type === "r") movedRooks.add(move.from);
  }
  return { get: (square: Square) => pieces.get(square), targets };
}
