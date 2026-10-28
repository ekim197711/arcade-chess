import { useEffect, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Square } from "chess.js";
import "./pieceDrag.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  square: Square;
  canDrag: boolean;
  positionKey: string;
  artwork: ReactNode;
  onPickUp: () => void;
  onMovePiece: (from: Square, to: Square, position: { x: number; y: number }) => void;
};
type Gesture = { id: number; x: number; y: number; size: number; dragging: boolean };

export function DragSquare({ square, canDrag, positionKey, artwork, onPickUp, onMovePiece, children, onClick, className, ...props }: Props) {
  const gesture = useRef<Gesture | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const suppressClick = useRef(false);
  const ghost = useRef<HTMLSpanElement>(null);

  function cancel() {
    const active = gesture.current;
    gesture.current = null;
    ghost.current?.style.setProperty("visibility", "hidden");
    button.current?.removeAttribute("data-dragging");
    if (active && button.current?.hasPointerCapture(active.id)) button.current.releasePointerCapture(active.id);
  }
  // Source-piece changes, resets, or navigation must not leave stale cursor artwork.
  useLayoutEffect(() => { cancel(); }, [positionKey, canDrag]);
  useEffect(() => {
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);

  return <>
    <button {...props} ref={button} data-square={square}
      className={`${className ?? ""} drag-square`}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => {
        if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; }
        onClick?.(event);
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
        if (!canDrag) return;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, size: event.currentTarget.getBoundingClientRect().width, dragging: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        if (!active.dragging && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 4) return;
        event.preventDefault();
        // Move the already-mounted artwork immediately. Creating a new image on
        // the first move can leave the cursor empty while its first paint waits.
        const preview = ghost.current;
        if (preview) {
          preview.style.width = `${active.size}px`;
          preview.style.height = `${active.size}px`;
          preview.style.transform = `translate3d(${event.clientX - active.size / 2}px, ${event.clientY - active.size / 2}px, 0)`;
          preview.style.visibility = "visible";
        }
        button.current?.setAttribute("data-dragging", "true");
        if (!active.dragging) {
          active.dragging = true;
          suppressClick.current = true;
          onPickUp();
        }
      }}
      onPointerUp={(event) => {
        const active = gesture.current;
        if (!active || active.id !== event.pointerId) return;
        if (active.dragging) {
          event.preventDefault();
          const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-square]");
          const board = event.currentTarget.closest(".chessboard");
          if (target && board?.contains(target)) onMovePiece(square, target.dataset.square as Square, { x: event.clientX, y: event.clientY });
        }
        cancel();
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >{children}</button>
    {canDrag && createPortal(<span ref={ghost} aria-hidden="true" className="piece-drag-ghost">{artwork}</span>, document.body)}
  </>;
}
