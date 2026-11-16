import { useRef } from "react";
import { usePieceMotion } from "./moveAnimation";
import type { ComponentProps, CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { DragSquare } from "./DragSquare";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import type { Chess } from "./chess";
import type { PlannedMove } from "./premoves";
import "./boardShared.css";
import { BoardResizeHandle } from "./BoardResizeHandle";

type Piece = ReturnType<Chess["get"]>;
type SquareProps = Omit<ComponentProps<typeof DragSquare>,"artwork"|"children"> & {piece:Piece;theme:PieceStyle;children?:ReactNode};
export function BoardSquare({piece,theme,children,...props}:SquareProps) {
 const artwork=piece&&<PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare/>;
 return <DragSquare {...props} data-piece={piece ? `${piece.color}${piece.type}` : undefined} artwork={artwork}>{piece&&<span className={`chess-piece ${piece.color==="w"?"white-piece-glyph":"black-piece-glyph"}`}>{artwork}</span>}{children}</DragSquare>;
}
export function BoardPanel({className="",...props}:HTMLAttributes<HTMLElement>) {
 return <aside {...props} className={`board-panel ${className}`}/>;
}

/** All playable boards use this frame, coordinates, loading state and resize grip. */
export function ChessBoardFrame({ children, color = "w", light, dark, width, loading, onResize, frameRef }: {
  children: ReactNode; color?: "w" | "b"; light: string; dark: string; width?: number;
  loading?: boolean; onResize?: (width: number | undefined) => void; frameRef?: Ref<HTMLDivElement>;
}) {
  const motionRef = useRef<HTMLDivElement>(null);
  usePieceMotion(motionRef, color);
  const files = Array.from({ length: 8 }, (_, index) => String.fromCharCode(97 + (color === "w" ? index : 7 - index)));
  return <div ref={element => { motionRef.current = element; if (typeof frameRef === "function") frameRef(element); else if (frameRef) frameRef.current = element; }} className="board-frame" data-shared-board="true" style={{ "--board-square-light": light, "--board-square-dark": dark, "--board-width": width === undefined ? undefined : `${width}px` } as CSSProperties}>
    <div className="board-coordinates board-files-top">{files.map(file => <span key={file}>{file}</span>)}</div>
    <div className="board-wrap"><div className="board-coordinates board-ranks">{files.map((_, index) => <span key={index}>{color === "w" ? 8 - index : index + 1}</span>)}</div>{children}</div>
    <div className="board-coordinates board-files-bottom">{files.map(file => <span key={file}>{file}</span>)}</div>
    {loading && <div className="piece-style-loading" role="status"><span className="piece-style-spinner" aria-hidden="true" /><span>Please wait</span></div>}
    {onResize && <BoardResizeHandle onResize={onResize} />}
  </div>;
}
export function PremoveControl({moves,onCancel}: {moves:readonly PlannedMove[];onCancel:()=>void}) {
 if(!moves.length)return null;
 return <button type="button" className="premove-cancel" onClick={onCancel} aria-label={moves.length===1?"Cancel premove":`Cancel all ${moves.length} premoves`}><span>{moves.length} PREMOVE{moves.length===1?"":"S"} QUEUED</span><b>{moves.map(move=>`${move.from}\u2192${move.to}`).join(" / ")}</b><span aria-hidden="true">CANCEL</span></button>;
}
