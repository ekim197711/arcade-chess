import type { PlayMode } from "./chess";
import { ONLINE_TIME_CONTROLS } from "./onlineChess";

export function OnlineQuickStart({ onStart, disabled = false }: {
  onStart: (minutes: number, mode: PlayMode) => void; disabled?: boolean;
}) {
  return <div className="online-quick-start">
    {(["standard", "freestyle"] as const).map(mode => <fieldset key={mode} disabled={disabled} className={`online-quick-mode online-quick-${mode}`}>
      <legend>{mode === "standard" ? "Standard" : "Freestyle · Chess960"}</legend>
      <div className="online-quick-times">{ONLINE_TIME_CONTROLS.map(minutes => <button key={minutes} type="button"
        aria-label={`Start ${minutes} minute ${mode === "standard" ? "Standard" : "Freestyle"} game against a human`}
        onClick={() => onStart(minutes, mode)}><strong>{minutes}</strong><span>min</span></button>)}</div>
    </fieldset>)}
    <p className="online-quick-note">Choose a time to find an opponent. Minutes per player, no increment. Unrated bot practice starts after 20 seconds if no human is available.</p>
  </div>;
}
