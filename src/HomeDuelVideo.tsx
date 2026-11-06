import { useEffect, useRef } from "react";

/** Generated comic artwork is served locally; its controls and motion policy live in the strip. */
export function HomeDuelVideo() {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let pending = 0;
    const resize = () => {
      const element = frame.current;
      if (element) {
        const height = `${Math.ceil(Math.min(element.clientWidth, 560) / 1.6 + 55)}px`;
        if (element.style.height !== height) element.style.height = height;
      }
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(resize);
    });
    if (frame.current) observer.observe(frame.current);
    resize();
    return () => { observer.disconnect(); cancelAnimationFrame(pending); };
  }, []);
  return <iframe ref={frame} className="home-comic-strip"
    src="/animations/comic-duels/strip.html"
    title="Medieval chess scene — changes every ten seconds"
    style={{ display: "block", width: "100%", height: 240, border: "1px solid #4a5278", borderRadius: 9, marginTop: 16 }} />;
}
