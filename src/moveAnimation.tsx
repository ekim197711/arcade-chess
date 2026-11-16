import { useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const key = "arcade-move-animation-seconds";
const changed = "arcade-move-animation-changed";
function read() {
  try {
    const saved = localStorage.getItem(key);
    const value = saved === null ? 0.15 : Number(saved);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.15;
  } catch { return 0.15; }
}
function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(changed, callback); window.removeEventListener("storage", callback); };
}
function useDuration() { return useSyncExternalStore(subscribe, read, () => 0.15); }

export function MoveAnimationSetting() {
  const duration = useDuration();
  return <label className="move-animation-setting">Move animation: {duration.toFixed(2)} s
    <input aria-label="Move animation duration" type="range" min="0" max="1" step="0.05" value={duration}
      onChange={event => {
        try { localStorage.setItem(key, event.target.value); } catch { return; }
        window.dispatchEvent(new Event(changed));
      }} />
    <small>0 s turns animations off.</small>
  </label>;
}

type Entry = { square: string; piece: string; x: number; y: number; element: HTMLElement; scale: number; dragging: boolean };
/** Animate only visual movement; game state and pointer handling never wait for it. */
export function usePieceMotion(root: RefObject<HTMLDivElement | null>, identity: string) {
  const duration = useDuration();
  const previous = useRef<{ identity: string; entries: Entry[] }>({ identity, entries: [] });
  const active = useRef(new Set<Animation>());
  useLayoutEffect(() => {
    const entries = Array.from(root.current?.querySelectorAll<HTMLElement>("[data-piece]") ?? []).flatMap(square => {
      const element = square.querySelector<HTMLElement>(".chess-piece");
      if (!element || !square.dataset.piece) return [];
      const rect = square.getBoundingClientRect();
      return [{ square: square.dataset.square!, piece: square.dataset.piece, x: rect.x, y: rect.y, element, scale: rect.width / square.offsetWidth || 1, dragging: square.hasAttribute("data-dragging") }];
    });
    const old = previous.current.identity === identity ? previous.current.entries : [];
    previous.current = { identity, entries };
    const removed = old.filter(a => !entries.some(b => a.square === b.square && a.piece === b.piece));
    const added = entries.filter(a => !old.some(b => a.square === b.square && a.piece === b.piece));
    if (!duration || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      active.current.forEach(animation => animation.cancel()); active.current.clear(); return;
    }
    // A reset/new game must appear immediately, rather than flying 32 pieces.
    if (!old.length || added.length > 4) return;
    for (const target of added) {
      const index = removed.findIndex(source => source.piece === target.piece || (source.piece === `${target.piece[0]}p` && /[18]$/.test(target.square)));
      if (index < 0) continue;
      const [source] = removed.splice(index, 1);
      if (source.dragging) continue;
      target.element.getAnimations().forEach(animation => animation.cancel());
      const animation = target.element.animate([
        { zIndex: 5, transform: `translate(${(source.x - target.x) / target.scale}px, ${(source.y - target.y) / target.scale}px)` },
        { zIndex: 5, transform: "translate(0, 0)" },
      ], { duration: duration * 1000, easing: "cubic-bezier(.2,.7,.3,1)" });
      active.current.add(animation);
      animation.finished.then(() => active.current.delete(animation), () => active.current.delete(animation));
    }
  });
  useLayoutEffect(() => () => { active.current.forEach(animation => animation.cancel()); }, []);
}
