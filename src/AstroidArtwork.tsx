import { useId, type CSSProperties } from "react";

export function AstroidArtwork({ color = "#b79a72" }: { color?: string }) {
  const id = useId().replace(/:/g, "");
  return <svg viewBox="0 0 160 160" aria-hidden="true"><defs><radialGradient id={id} cx="30%" cy="25%"><stop stopColor="#eee0c4" /><stop offset=".4" stopColor={color} /><stop offset="1" stopColor="#302a36" /></radialGradient></defs>
    <path d="M42 15 87 8 123 28 150 62 142 110 109 146 65 153 23 127 8 83 20 40Z" fill={`url(#${id})`} stroke="#211f2a" strokeWidth="5" />
    <path d="m43 18 5 30-19 25 8 35 36 18 9 24M122 29 102 51l16 35-14 24 7 33" fill="none" stroke="#332e3d" strokeWidth="4" opacity=".6" />
    <g fill="#342c35" opacity=".5"><ellipse cx="55" cy="44" rx="17" ry="12" /><ellipse cx="112" cy="107" rx="14" ry="20" /><ellipse cx="46" cy="112" rx="12" ry="10" /><circle cx="108" cy="42" r="8" /></g>
    <path d="m42 72 26 7-7 12-17-4zm76 0-26 7 7 12 17-4z" fill="#ffe092" /><path d="m58 111 18-6 25 2-13 12-18-2z" fill="#241d25" />
  </svg>;
}

export function AstroidScene({ outcome, color }: { outcome?: "win" | "loss"; color: string }) {
  return <div className={`astroid-scene astroid-scene-${outcome ?? "idle"}`} role="img" aria-label={outcome === "win" ? "Asteroid exploding into fragments" : outcome === "loss" ? "Asteroid smashing into your spaceship" : "Your ship faces the asteroid boss"}>
    <div className="astroid-orbit" />
    <div className="astroid-scene-rock"><AstroidArtwork color={color} /></div>
    <div className="astroid-fragments" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--fragment-angle": `${i * 30}deg`, "--fragment-color": color } as CSSProperties} />)}</div>
    <div className="astroid-shockwave" />
    <svg className="astroid-ship" viewBox="0 0 140 100" aria-hidden="true"><g className="astroid-ship-hull"><path d="m70 8 17 39 39 32-39-3-17 11-17-11-39 3 39-32z" fill="#9fcbd4" stroke="#233341" strokeWidth="4" /><path d="m70 24 9 28-9 12-9-12z" fill="#276975" /><path d="m46 64-18 9 28-1m38-8 18 9-28-1" stroke="#e3bc78" strokeWidth="5" /></g><path className="astroid-ship-flame" d="m60 82 10 17 10-17" fill="#f1bb69" /></svg>
    <div className="astroid-impact" />
  </div>;
}
