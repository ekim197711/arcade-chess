import { useEffect, useRef, useState, type CSSProperties } from "react";
import { bossThumbnail } from "./bossArtwork";
import "./dancingBosses.css";

type DancingBoss = { name: string; character?: string; taunts: readonly string[] };

export function DancingBosses({ bosses, playerName }: { bosses: readonly DancingBoss[]; playerName: string }) {
  const dancers = bosses.flatMap((boss) => {
    const portrait = bossThumbnail(boss.character, __BOSS_PORTRAITS__, "taunting");
    return portrait ? [{ boss, portrait }] : [];
  });
  const [taunt, setTaunt] = useState<{ name: string; text: string; serial: number } | null>(null);
  const [hidden, setHidden] = useState(document.hidden);
  const [cycles, setCycles] = useState<Record<number, number>>({});
  const slots = Math.min(12, dancers.length);
  const counts = useRef<Record<string, number>>({});
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!taunt) return;
    const timer = window.setTimeout(() => setTaunt(null), 6000);
    return () => window.clearTimeout(timer);
  }, [taunt]);

  function provoke(boss: DancingBoss, index: number) {
    const count = counts.current[boss.name] ?? 0;
    counts.current[boss.name] = count + 1;
    setTaunt({ name: boss.name, text: boss.taunts[(index + count) % boss.taunts.length]!.replaceAll("{pilot}", playerName), serial: (taunt?.serial ?? 0) + 1 });
  }

  return <>
    <div className={`dancing-bosses${hidden ? " dancing-bosses-paused" : ""}`} role="group" aria-label="Dancing bosses. Click a boss for a taunt.">
      {dancers.slice(0, slots).map((_, slot) => {
        const index = (slot + (cycles[slot] ?? 0) * slots) % dancers.length;
        const { boss, portrait } = dancers[index];
        return <div className="dancing-boss-route" key={slot} onAnimationIteration={event => {
          if (event.target === event.currentTarget && event.animationName === "boss-parade") setCycles(current => ({ ...current, [slot]: (current[slot] ?? 0) + 1 }));
        }} style={{
          "--parade-delay": `${-slot * 240 / slots}s`,
          "--dance-delay": `${-index * .17}s`,
        } as CSSProperties}>
          <button className="dancing-boss" type="button" aria-label={`Hear a taunt from ${boss.name}`} title={boss.name} onClick={() => provoke(boss, index)}>
            <img src={portrait} width={112} height={112} alt="" draggable={false} decoding="async" loading="lazy" />
          </button>
        </div>;
      })}
    </div>
    <div className="dancing-boss-announcement" role="status" aria-live="polite" aria-atomic="true">
      {taunt && <div className="dancing-boss-quip" key={taunt.serial}>
        <div><strong>{taunt.name}</strong><p>{taunt.text}</p></div>
        <button type="button" onClick={() => setTaunt(null)} aria-label="Dismiss boss taunt">×</button>
      </div>}
    </div>
  </>;
}
