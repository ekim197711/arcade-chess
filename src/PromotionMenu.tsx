import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import type { Color } from "./chess";
import "./promotionMenu.css";

export type PromotionPiece = "q" | "r" | "b" | "n";
export type PromotionPosition = { x: number; y: number };
const choices: { type: PromotionPiece; label: string }[] = [
  { type: "q", label: "Queen" }, { type: "r", label: "Rook" },
  { type: "b", label: "Bishop" }, { type: "n", label: "Knight" },
];

export function PromotionMenu({ position, color, theme, onChoose, onCancel }: {
  position: PromotionPosition;
  color: Color;
  theme: PieceStyle;
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  const [location, setLocation] = useState(position);

  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    setLocation({
      x: Math.max(8, Math.min(position.x - 16, window.innerWidth - box.width - 8)),
      y: Math.max(8, Math.min(position.y - 20, window.innerHeight - box.height - 8)),
    });
  }, [position]);

  useLayoutEffect(() => {
    const previous = document.activeElement;
    const element = menu.current;
    element?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element?.contains(event.target)) cancel.current();
    };
    const dismiss = () => cancel.current();
    const scroll = (event: Event) => {
      if (event.target instanceof Node && element?.contains(event.target)) return;
      dismiss();
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
      if (element?.contains(document.activeElement) && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  return createPortal(
    <div ref={menu} className="promotion-menu" role="menu" aria-label="Promote your pawn"
      style={{ left: location.x, top: location.y }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab") {
          if (event.key === "Escape") event.preventDefault();
          onCancel();
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }}>
      {choices.map(choice => (
        <button key={choice.type} type="button" role="menuitem" className="promotion-option"
          aria-label={`Promote to ${choice.label}`} onClick={() => onChoose(choice.type)}>
          <span className="promotion-artwork" aria-hidden="true">
            <PieceArtwork type={choice.type} color={color} theme={theme} fitToSquare />
          </span>
          <span>{choice.label}</span>
          {choice.type === "q" && <span className="promotion-default" aria-hidden="true">Enter ↵</span>}
        </button>
      ))}
      <button type="button" role="menuitem" className="promotion-cancel" onClick={onCancel}>Cancel</button>
    </div>, document.body,
  );
}
