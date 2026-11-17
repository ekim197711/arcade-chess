import { GameStartButton } from "./GameStartButton";
import type { PlayMode } from "./chess";
import { ONLINE_TIME_CONTROLS } from "./onlineChess";
import { useState } from "react";
import { ArrowUpRight, Flame, Timer, Zap } from "lucide-react";

export function OnlineQuickStart({ onStart, disabled = false }: {
  onStart: (minutes: number, mode: PlayMode) => void; disabled?: boolean;
}) {
  const [mode, setMode] = useState<PlayMode>("standard");
  return <div className="online-quick-start">
    <div className="arena-segmented" role="group" aria-label="Human game variant"><button disabled={disabled} aria-pressed={mode === "standard"} onClick={() => setMode("standard")}>Standard chess</button><button disabled={disabled} aria-pressed={mode === "freestyle"} onClick={() => setMode("freestyle")}>Freestyle <small>960</small></button></div>
    <fieldset disabled={disabled} aria-label={mode === "standard" ? "Standard" : "Freestyle · Chess960"} className={`online-quick-mode online-quick-${mode}`}>
      <legend>Time per player ? no added time</legend>
      <div className="online-quick-times">{ONLINE_TIME_CONTROLS.map(minutes => <GameStartButton key={minutes}
        aria-label={`Start ${minutes} minute ${mode === "standard" ? "Standard" : "Freestyle"} game against a human`}
        onClick={() => onStart(minutes, mode)}>{minutes <= 3 ? <Zap size={20} /> : minutes <= 5 ? <Flame size={20} /> : <Timer size={20} />}<span className="online-quick-button-time"><strong>{minutes}</strong><span>MIN</span></span><span className="online-quick-button-mode">{minutes <= 5 ? "Blitz" : "Rapid"}</span><ArrowUpRight className="quick-arrow" size={15} /></GameStartButton>)}</div>
    </fieldset>
  </div>;
}
