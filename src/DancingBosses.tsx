import { useEffect, useRef, useState, type CSSProperties } from "react";
import { bossPortrait } from "./bossArtwork";
import "./dancingBosses.css";

type DancingBoss = { name: string; character?: string; taunts: readonly string[] };

export function DancingBosses({ bosses, playerName }: { bosses: readonly DancingBoss[]; playerName: string }) {
  const dancers = bosses.flatMap((boss) => {
    const portrait = bossPortrait(boss.character, __BOSS_PORTRAITS__, "taunting");
    return portrait ? [{ boss, portrait }] : [];
  });
  const [taunt, setTaunt] = useState<{ name: string; text: string; serial: number } | null>(null);
  const [hidden, setHidden] = useState(document.hidden);
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
      {dancers.map(({ boss, portrait }, index) => {
        return <div className="dancing-boss-route" key={boss.name} style={{
          "--parade-delay": `${-index * 240 / dancers.length}s`,
          "--dance-delay": `${-index * .17}s`,
        } as CSSProperties}>
          <button className="dancing-boss" type="button" aria-label={`Hear a taunt from ${boss.name}`} title={boss.name} onClick={() => provoke(boss, index)}>
            <img src={portrait} alt="" draggable={false} decoding="async" />
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
