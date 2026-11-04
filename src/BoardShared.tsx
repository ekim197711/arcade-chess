import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { DragSquare } from "./DragSquare";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import type { Chess } from "./chess";
import type { PlannedMove } from "./premoves";
import "./boardShared.css";

type Piece = ReturnType<Chess["get"]>;
type SquareProps = Omit<ComponentProps<typeof DragSquare>,"artwork"|"children"> & {piece:Piece;theme:PieceStyle;children?:ReactNode};
export function BoardSquare({piece,theme,children,...props}:SquareProps) {
 const artwork=piece&&<PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare/>;
 return <DragSquare {...props} artwork={artwork}>{piece&&<span className={`chess-piece ${piece.color==="w"?"white-piece-glyph":"black-piece-glyph"}`}>{artwork}</span>}{children}</DragSquare>;
}
export function BoardPanel({className="",...props}:HTMLAttributes<HTMLElement>) {
 return <aside {...props} className={`board-panel ${className}`}/>;
}
export function PremoveControl({moves,onCancel}: {moves:readonly PlannedMove[];onCancel:()=>void}) {
 if(!moves.length)return null;
 return <button type="button" className="premove-cancel" onClick={onCancel} aria-label={moves.length===1?"Cancel premove":`Cancel all ${moves.length} premoves`}><span>{moves.length} PREMOVE{moves.length===1?"":"S"} QUEUED</span><b>{moves.map(move=>`${move.from}\u2192${move.to}`).join(" / ")}</b><span aria-hidden="true">CANCEL</span></button>;
}
