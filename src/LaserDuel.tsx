import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

/** Original AI artwork, animated locally. No video download or autoplay audio. */
export function LaserDuel() {
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem("arcade-laser-duel-paused") === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch { return true; }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { if (media.matches) setPaused(true); };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return <div className={`laser-duel${paused ? " is-paused" : ""}`} aria-label="Animated chess laser duel">
    <div className="duel-caption"><span className="live-dot" /><span>AFTER HOURS</span><small>KNIGHT vs. ROOK</small></div>
    <div className="duel-stage" aria-hidden="true">
      <img className="duel-fighter duel-knight" src="/art/laser-duel.webp" alt="" />
      <img className="duel-fighter duel-rook" src="/art/laser-duel.webp" alt="" />
      <i className="laser-bolt bolt-cyan" /><i className="laser-bolt bolt-magenta" /><i className="laser-impact" />
      <div className="duel-floor" />
    </div>
    <button type="button" className="duel-toggle" aria-label={paused ? "Play chess laser animation" : "Pause chess laser animation"} aria-pressed={!paused} onClick={() => setPaused(value => {
      try { localStorage.setItem("arcade-laser-duel-paused", String(!value)); } catch { /* Session preference is enough. */ }
      return !value;
    })}>{paused ? <Play size={13} /> : <Pause size={13} />}<span>{paused ? "PLAY" : "PAUSE"}</span></button>
  </div>;
}
