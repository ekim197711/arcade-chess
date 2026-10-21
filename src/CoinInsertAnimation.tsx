import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./animations/coinInsert";
import type { CoinInsert } from "./animations/coinInsert";

export const COIN_INSERT_VARIANTS = ["bounce", "flip", "rocket"] as const;
export type CoinInsertAnimationHandle = { play: () => boolean };
type Props = { volume: number; muted: boolean; onReady: () => void };

export const CoinInsertAnimation = forwardRef<CoinInsertAnimationHandle, Props>(function CoinInsertAnimation({ volume, muted, onReady }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const animation = useRef<CoinInsert | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    if (!host.current) return;
    const element = document.createElement("coin-insert") as CoinInsert;
    element.setAttribute("variant", "bounce");
    host.current.append(element);
    animation.current = element;
    onReady();
    return () => {
      sequence.current++;
      animation.current?.stop();
      animation.current?.remove();
      animation.current = null;
      if (host.current) host.current.hidden = true;
    };
  }, [onReady]);

  useEffect(() => {
    if (!animation.current) return;
    animation.current.audio.volume = volume;
    animation.current.audio.muted = muted;
  }, [volume, muted]);

  useImperativeHandle(ref, () => ({
    play() {
      const element = animation.current;
      const stage = host.current;
      if (!element || !stage) return false;
      const run = ++sequence.current;
      const variant = COIN_INSERT_VARIANTS[Math.floor(Math.random() * COIN_INSERT_VARIANTS.length)]!;
      element.stop();
      element.setAttribute("variant", variant);
      element.render();
      stage.hidden = false;
      void element.play({ volume, muted }).then(() => {
        if (sequence.current === run) stage.hidden = true;
      });
      return true;
    },
  }), [volume, muted]);

  return <div ref={host} className="coin-insert-stage" hidden aria-hidden="true" />;
});
