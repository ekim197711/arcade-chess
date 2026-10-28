import { useId, useMemo, type CSSProperties } from "react";
import { Chess, type Color, type Square } from "./chess";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import "./review.css";

export function FinalPositionBoard({ pgn, color, theme, light, dark }: {
  pgn: string; color: Color; theme: PieceStyle; light: string; dark: string;
}) {
  const title = useId();
  const { game, last } = useMemo(() => {
    const position = new Chess();
    position.loadPgn(pgn);
    return { game: position, last: position.history({ verbose: true }).at(-1) };
  }, [pgn]);
  const checkmate = game.isCheckmate();
  return <section className="final-position" aria-labelledby={title}>
    <h2 id={title}>Final position</h2>
    {checkmate && <p className="final-position-caption">{game.turn() === "w" ? "White" : "Black"} is checkmated.</p>}
    <div className="final-position-frame">
      <div className="review-board chessboard" role="group" aria-label="Final chessboard"
        style={{ "--board-square-light": light, "--board-square-dark": dark } as CSSProperties}>
        {Array.from({ length: 64 }, (_, index) => {
          const row = Math.floor(index / 8), column = index % 8;
          const square = `${String.fromCharCode(97 + (color === "w" ? column : 7 - column))}${color === "w" ? 8 - row : row + 1}` as Square;
          const piece = game.get(square);
          const lastMove = square === last?.from || square === last?.to;
          const mated = checkmate && piece?.type === "k" && piece.color === game.turn();
          return <div key={square} data-square={square}
            className={`square square-${(row + column) % 2 ? "dark" : "light"}${lastMove ? " review-highlight" : ""}${mated ? " final-position-checkmate" : ""}`}
            aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""}${mated ? " checkmated king" : ""}`}>
            {piece && <span className={`chess-piece ${piece.color === "w" ? "white-piece-glyph" : "black-piece-glyph"}`}><PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare /></span>}
          </div>;
        })}
      </div>
    </div>
  </section>;
}
