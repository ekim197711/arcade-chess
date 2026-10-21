import { useRef } from "react";
import { Grip } from "lucide-react";

type Props = { onResize: (width: number | undefined) => void };

export function BoardResizeHandle({ onResize }: Props) {
  const drag = useRef<{ x: number; y: number; width: number } | null>(null);

  function limits(handle: HTMLElement) {
    const frame = handle.parentElement!;
    const stage = frame.parentElement!;
    const max = Math.max(0, Math.min(
      stage.clientWidth,
      window.matchMedia("(min-width: 761px)").matches
        ? stage.clientHeight - 32
        : stage.clientWidth,
    ));
    return { width: frame.getBoundingClientRect().width, min: Math.min(240, max), max };
  }

  return (
    <button
      type="button"
      className="board-resize-handle"
      aria-label="Resize chessboard"
      title="Drag to resize. Arrow keys adjust size; double-click or End restores auto-fit."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, width: limits(event.currentTarget).width };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const { min, max } = limits(event.currentTarget);
        // The board is centered, so its right edge moves half the width delta.
        const dx = (event.clientX - drag.current.x) * 2;
        const dy = event.clientY - drag.current.y;
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        onResize(Math.max(min, Math.min(max, drag.current.width + delta)));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onDoubleClick={() => onResize(undefined)}
      onKeyDown={(event) => {
        const { width, min, max } = limits(event.currentTarget);
        const step = event.shiftKey ? 50 : 10;
        if (event.key === "End") onResize(undefined);
        else if (event.key === "Home") onResize(min);
        else if (event.key === "ArrowRight" || event.key === "ArrowDown") onResize(Math.min(max, width + step));
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") onResize(Math.max(min, width - step));
        else return;
        event.preventDefault();
      }}
    >
      <Grip size={16} aria-hidden="true" />
    </button>
  );
}
