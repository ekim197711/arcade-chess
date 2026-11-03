import { useId } from "react";
import { Chess, type Color, type Move, type Square } from "./chess";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import { NotationText } from "./ChessNotation";

export function GambitMoveDiagram({move,side,theme}: {move:Move;side:Color;theme:PieceStyle}) {
 const marker=`gambit-diagram-${useId().replace(/[^a-zA-Z0-9_-]/g,"")}`;
 const game=new Chess(move.after);
 const files=side==="w"?"abcdefgh":"hgfedcba";
 const ranks=side==="w"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];
 const point=(square:Square)=>({x:(side==="w"?square.charCodeAt(0)-97:104-square.charCodeAt(0))+.5,y:(side==="w"?8-Number(square[1]):Number(square[1])-1)+.5});
 const from=point(move.from),to=point(move.to);
 const path=move.piece==="n"?`M ${from.x} ${from.y} L ${from.x} ${to.y} L ${to.x} ${to.y}`:`M ${from.x} ${from.y} L ${to.x} ${to.y}`;
 return <figure className="gambit-move-diagram">
   <div className="gambit-mini-frame">
     <div className="gambit-mini-ranks" aria-hidden="true">{ranks.map(rank=><span key={rank}>{rank}</span>)}</div>
     <div className="gambit-mini-board" role="img" aria-label={`Position after ${move.san}; ${move.color==="w"?"White":"Black"} moves from ${move.from} to ${move.to}`}>
       {ranks.flatMap(rank=>[...files].map(file=>{const square=`${file}${rank}` as Square;const piece=game.get(square);return <span key={square} className={`gambit-mini-square ${(file.charCodeAt(0)+rank)%2?"light":"dark"}${square===move.from?" diagram-from":""}${square===move.to?" diagram-to":""}`}>
         {piece&&<PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare/>}
       </span>;}))}
       <svg viewBox="0 0 8 8" className="gambit-diagram-arrow" aria-hidden="true" data-from={move.from} data-to={move.to}>
         <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
         <path d={path} markerEnd={`url(#${marker})`}/>
       </svg>
     </div>
     <div className="gambit-mini-files" aria-hidden="true">{[...files].map(file=><span key={file}>{file}</span>)}</div>
   </div>
   <figcaption><NotationText text={`${move.color==="w"?"White":"Black"}: ${move.san} (${move.from} to ${move.to})`}/></figcaption>
 </figure>;
}
