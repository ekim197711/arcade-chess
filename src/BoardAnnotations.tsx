import { useEffect, useId, useRef, useState } from "react";
import type { Color, Square } from "./chess";
import "./boardAnnotations.css";

type Arrow = { from: Square; to: Square };
type Gesture = { id: number; from: Square; to: Square | null };

export function BoardAnnotations({ color, positionKey, onCancelPremoves }: {
  color: Color; positionKey: string; onCancelPremoves?: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const cancelPremoves = useRef(onCancelPremoves); cancelPremoves.current = onCancelPremoves;
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [draft, setDraft] = useState<Arrow | null>(null);
  const marker = `thought-arrow-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const board = svg.current?.parentElement;
    if (!board) return;
    const oldTabIndex = board.getAttribute("tabindex");
    if (oldTabIndex === null) board.tabIndex = 0;
    setArrows([]); setDraft(null);
    const at = (event: PointerEvent): Square | null => {
      const box = board.getBoundingClientRect();
      const x = (event.clientX - box.left - board.clientLeft) / board.clientWidth;
      const y = (event.clientY - box.top - board.clientTop) / board.clientHeight;
      if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
      const file = Math.floor(x * 8), row = Math.floor(y * 8);
      return `${String.fromCharCode(97 + (color === "w" ? file : 7 - file))}${color === "w" ? 8 - row : row + 1}` as Square;
    };
    const release = () => {
      const current = gesture.current;
      gesture.current = null;
      if (current && board.hasPointerCapture(current.id)) board.releasePointerCapture(current.id);
    };
    const cancel = () => { release(); setDraft(null); };
    const down = (event: PointerEvent) => {
      if (event.button === 0) { cancel(); setArrows([]); return; }
      if (event.button !== 2 || !event.isPrimary) return;
      event.preventDefault();
      board.focus({ preventScroll: true });
      // Cancel on press, before a queued move can run or the drag can begin.
      cancelPremoves.current?.();
      const from = at(event);
      if (!from) return;
      gesture.current = { id: event.pointerId, from, to: from };
      board.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      event.preventDefault();
      const to = at(event);
      if (current.to === to) return;
      current.to = to;
      setDraft(to && to !== current.from ? { from: current.from, to } : null);
    };
    const up = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      event.preventDefault();
      const to = at(event);
      if (to === current.from) setArrows([]);
      else if (to) setArrows(previous => previous.some(arrow => arrow.from === current.from && arrow.to === to)
        ? previous.filter(arrow => arrow.from !== current.from || arrow.to !== to)
        : [...previous, { from: current.from, to }]);
      cancel();
    };
    const menu = (event: MouseEvent) => { event.preventDefault(); if (event.button !== 2) cancelPremoves.current?.(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { cancel(); setArrows([]); } };
    const lost = (event: PointerEvent) => { if (event.target === board) cancel(); };
    board.addEventListener("pointerdown", down, true);
    board.addEventListener("pointermove", move, true);
    board.addEventListener("pointerup", up, true);
    board.addEventListener("pointercancel", cancel);
    board.addEventListener("lostpointercapture", lost);
    board.addEventListener("contextmenu", menu);
    board.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      release();
      if (oldTabIndex === null) board.removeAttribute("tabindex");
      board.removeEventListener("pointerdown", down, true);
      board.removeEventListener("pointermove", move, true);
      board.removeEventListener("pointerup", up, true);
      board.removeEventListener("pointercancel", cancel);
      board.removeEventListener("lostpointercapture", lost);
      board.removeEventListener("contextmenu", menu);
      board.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
    };
  }, [color, positionKey]);

  const center = (square: Square) => {
    const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1;
    return { x: (color === "w" ? file : 7 - file) + .5, y: (color === "w" ? 7 - rank : rank) + .5 };
  };
  const draw = (arrow: Arrow, preview: boolean) => {
    const from = center(arrow.from), to = center(arrow.to);
    return <g key={`${arrow.from}:${arrow.to}`} className={preview ? "board-arrow-preview" : "board-thought-arrow"}
      role="img" aria-label={`${preview ? "Drawing" : "Arrow"} from ${arrow.from} to ${arrow.to}`} data-from={arrow.from} data-to={arrow.to}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd={`url(#${marker})`} />
    </g>;
  };
  return <svg ref={svg} className="board-annotations" viewBox="0 0 8 8" role="group" aria-label="Board analysis arrows">
    <defs><marker id={marker} viewBox="0 0 1 1" refX=".85" refY=".5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0 L1 .5 L0 1 Z" /></marker></defs>
    {arrows.map(arrow => draw(arrow, false))}
    {draft && draw(draft, true)}
  </svg>;
}
