import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Fit a complete screen, including unusually short windows and browser zoom. */
export function ScreenFit({ children, className = "" }: { children: ReactNode; className?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = viewport.current!, inner = content.current!;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = Math.max(inner.scrollHeight, inner.offsetHeight);
        const width = Math.max(inner.scrollWidth, inner.offsetWidth);
        const scale = Math.min(1, outer.clientHeight / Math.max(1, height), outer.clientWidth / Math.max(1, width));
        inner.style.transform = `scale(${scale})`;
        inner.style.setProperty("--screen-scale", String(scale));
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(outer); observer.observe(inner);
    const mutations = new MutationObserver(fit);
    mutations.observe(inner, { childList: true, subtree: true, characterData: true });
    inner.addEventListener("load", fit, true);
    window.addEventListener("resize", fit);
    fit();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); inner.removeEventListener("load", fit, true); window.removeEventListener("resize", fit); };
  }, []);
  return <div ref={viewport} className={`screen-fit ${className}`}><div ref={content} className="screen-fit-content">{children}</div></div>;
}
