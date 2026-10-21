import { Chess as StandardChess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import { Chess as Position, castlingSide, pseudoDests } from "chessops/chess";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { parsePgn } from "chessops/pgn";
import { makeSquare, parseSquare, roleToChar, charToRole } from "chessops/util";
import type { NormalMove } from "chessops/types";

export type { Color, Move, Square } from "chess.js";
export type PlayMode = "standard" | "freestyle";
const MARKER = " chess960";
type Options = { verbose?: boolean; square?: Square; piece?: PieceSymbol; legal?: boolean };

// A six-field FEN goes into PGN. Internal snapshots carry a variant marker so
// workers and variations keep Chess960 rules even after all castling rights end.
export class Chess {
  private standard: StandardChess;
  private position?: Position;
  private initialFen = "";
  private played: Move[] = [];
  private snapshots: Position[] = [];

  constructor(fen?: string) {
    this.standard = new StandardChess(fen?.endsWith(MARKER) ? undefined : fen);
    if (fen?.endsWith(MARKER)) this.loadFreestyle(fen.slice(0, -MARKER.length));
  }

  private loadFreestyle(fen: string) {
    this.position = Position.fromSetup(parseFen(fen).unwrap()).unwrap();
    this.initialFen = makeFen(this.position.toSetup());
    this.played = [];
    this.snapshots = [];
  }

  get mode(): PlayMode { return this.position ? "freestyle" : "standard"; }
  fen() { return this.position ? makeFen(this.position.toSetup()) + MARKER : this.standard.fen(); }
  turn(): Color { return this.position ? this.position.turn === "white" ? "w" : "b" : this.standard.turn(); }
  get(square: Square) {
    if (!this.position) return this.standard.get(square);
    const piece = this.position.board.get(parseSquare(square));
    return piece ? { type: roleToChar(piece.role) as PieceSymbol, color: (piece.color === "white" ? "w" : "b") as Color } : undefined;
  }
  board() {
    if (!this.position) return this.standard.board();
    return Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, file) => {
      const square = makeSquare((7 - row) * 8 + file);
      const piece = this.get(square);
      return piece ? { ...piece, square } : null;
    }));
  }

  premoveTargets(square: Square, color: Color): Square[] {
    if (this.position) {
      const pos = this.position.clone();
      pos.turn = color === "w" ? "white" : "black";
      pos.epSquare = undefined;
      return [...pseudoDests(pos, parseSquare(square), pos.ctx())].map(makeSquare);
    }
    const fields = this.fen().split(" ");
    fields[1] = color;
    fields[3] = "-";
    const pos = new StandardChess(fields.join(" "));
    // chess.js accepts legal:false at runtime but omits it from public types.
    const generate = pos.moves as unknown as (options: Options) => Move[];
    return generate.call(pos, { square, verbose: true, legal: false }).map((move) => move.to);
  }

  private describe(move: NormalMove): Move {
    const pos = this.position!;
    const piece = pos.board.get(move.from)!;
    const side = castlingSide(pos, move);
    const ep = piece.role === "pawn" && move.to === pos.epSquare;
    const captured = side ? undefined : ep ? "p" : pos.board.get(move.to)?.role;
    const after = pos.clone();
    const san = makeSan(pos, move);
    after.play(move);
    const promotion = move.promotion ? roleToChar(move.promotion) as PieceSymbol : undefined;
    const from = makeSquare(move.from);
    // King-to-rook input is unambiguous, including stationary-king castling.
    const to = makeSquare(move.to);
    const bigPawn = piece.role === "pawn" && Math.abs(move.to - move.from) === 16;
    return {
      from, to, color: this.turn(), piece: roleToChar(piece.role) as PieceSymbol,
      captured: captured ? captured === "p" ? "p" : roleToChar(captured) as PieceSymbol : undefined,
      promotion, san, lan: from + to + (promotion ?? ""), before: this.fen(),
      after: makeFen(after.toSetup()) + MARKER,
      flags: side ? side === "h" ? "k" : "q" : ep ? "e" : captured ? "c" : bigPawn ? "b" : "n",
      isCapture: () => !!captured && !ep, isPromotion: () => !!promotion,
      isEnPassant: () => ep, isKingsideCastle: () => side === "h",
      isQueensideCastle: () => side === "a", isBigPawn: () => bigPawn,
    };
  }

  moves(options: Options & { verbose: true }): Move[];
  moves(options?: Options & { verbose?: false }): string[];
  moves(options: Options = {}): Move[] | string[] {
    if (!this.position) return options.verbose
      ? this.standard.moves({ ...options, verbose: true })
      : this.standard.moves({ ...options, verbose: false });
    const result: Move[] = [];
    const pos = this.position;
    const ctx = pos.ctx();
    for (const [from, destinations] of pos.allDests(ctx)) {
      if (options.square && makeSquare(from) !== options.square) continue;
      const piece = pos.board.get(from)!;
      if (options.piece && roleToChar(piece.role) !== options.piece) continue;
      for (const to of destinations) {
        const promotions = piece.role === "pawn" && (to < 8 || to >= 56)
          ? ["queen", "rook", "bishop", "knight"] as const : [undefined];
        for (const promotion of promotions) result.push(this.describe({ from, to, promotion }));
      }
    }
    return options.verbose ? result : result.map((move) => move.san);
  }

  move(input: string | { from: string; to: string; promotion?: string } | null): Move {
    if (!this.position) return this.standard.move(input);
    const pos = this.position;
    const parsed = typeof input === "string" ? parseSan(pos, input) : input ? {
      from: parseSquare(input.from), to: parseSquare(input.to),
      promotion: input.promotion && this.get(input.from as Square)?.type === "p" && /[18]$/.test(input.to)
        ? charToRole(input.promotion) : undefined,
    } : undefined;
    if (!parsed || !("from" in parsed) || parsed.from === undefined || parsed.to === undefined || !pos.isLegal(parsed as NormalMove)) {
      throw new Error("Illegal Chess960 move");
    }
    const move = parsed as NormalMove;
    const result = this.describe(move);
    this.snapshots.push(pos.clone());
    this.played.push(result);
    pos.play(move);
    return result;
  }
  undo(): Move | null {
    if (!this.position) return this.standard.undo();
    const previous = this.snapshots.pop();
    if (!previous) return null;
    this.position = previous;
    return this.played.pop()!;
  }
  history(options: { verbose: true }): Move[];
  history(options?: { verbose?: false }): string[];
  history(options?: { verbose?: boolean }): Move[] | string[] {
    if (!this.position) return options?.verbose ? this.standard.history({ verbose: true }) : this.standard.history();
    return options?.verbose ? [...this.played] : this.played.map((move) => move.san);
  }
  pgn(): string {
    if (!this.position) return this.standard.pgn();
    const setup = parseFen(this.initialFen).unwrap();
    let number = setup.fullmoves;
    let turn = setup.turn;
    const tokens: string[] = [];
    for (const move of this.played) {
      if (turn === "white") tokens.push(`${number}.`);
      else if (!tokens.length) tokens.push(`${number}...`);
      tokens.push(move.san);
      if (turn === "black") number++;
      turn = turn === "white" ? "black" : "white";
    }
    return `[Variant "Chess960"]\n[SetUp "1"]\n[FEN "${this.initialFen}"]\n\n${tokens.join(" ")} *`;
  }
  loadPgn(pgn: string) {
    if (!/\[Variant\s+"Chess960"\]/i.test(pgn)) {
      this.standard = new StandardChess();
      this.standard.loadPgn(pgn);
      this.position = undefined;
      return;
    }
    const game = parsePgn(pgn)[0];
    const fen = game?.headers.get("FEN");
    if (!game || !fen) throw new Error("Missing Chess960 setup");
    this.loadFreestyle(fen);
    for (const node of game.moves.mainline()) this.move(node.san);
  }
  isCheck() { return this.position ? this.position.isCheck() : this.standard.isCheck(); }
  isCheckmate() { return this.position ? this.position.isCheckmate() : this.standard.isCheckmate(); }
  isStalemate() { return this.position ? this.position.isStalemate() : this.standard.isStalemate(); }
  isInsufficientMaterial() { return this.position ? this.position.isInsufficientMaterial() : this.standard.isInsufficientMaterial(); }
  isThreefoldRepetition() {
    if (!this.position) return this.standard.isThreefoldRepetition();
    const key = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
    const current = key(this.fen());
    return [this.initialFen, ...this.played.map((move) => move.after)].filter((fen) => key(fen) === current).length >= 3;
  }
  isDraw() { return this.position ? this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition() || this.position.halfmoves >= 100 : this.standard.isDraw(); }
  isGameOver() { return this.position ? this.isCheckmate() || this.isDraw() : this.standard.isGameOver(); }
}

// Scharnagl numbering enumerates each of the 960 legal arrays exactly once.
export function freestyleFen(index = Math.floor(Math.random() * 960)): string {
  if (!Number.isInteger(index) || index < 0 || index >= 960) throw new Error("Invalid Chess960 position number");
  const rank = Array<string>(8).fill("");
  let n = index;
  rank[(n % 4) * 2 + 1] = "B"; n = Math.floor(n / 4);
  rank[(n % 4) * 2] = "B"; n = Math.floor(n / 4);
  const empty = () => rank.flatMap((piece, file) => piece ? [] : [file]);
  rank[empty()[n % 6]!] = "Q"; n = Math.floor(n / 6);
  const pairs = [[0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]];
  const slots = empty();
  for (const knight of pairs[n]!) rank[slots[knight]!] = "N";
  empty().forEach((file, i) => { rank[file] = ["R", "K", "R"][i]!; });
  const rights = rank.flatMap((piece, file) => piece === "R" ? [String.fromCharCode(65 + file)] : []).reverse().join("");
  const back = rank.join("");
  return `${back.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${back} w ${rights}${rights.toLowerCase()} - 0 1${MARKER}`;
}
