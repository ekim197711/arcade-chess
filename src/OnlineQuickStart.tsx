import { GameStartButton } from "./GameStartButton";
import type { PlayMode } from "./chess";
import { ONLINE_TIME_CONTROLS } from "./onlineChess";

export function OnlineQuickStart({ onStart, disabled = false }: {
  onStart: (minutes: number, mode: PlayMode) => void; disabled?: boolean;
}) {
  return <div className="online-quick-start">
    {(["standard", "freestyle"] as const).map(mode => <fieldset key={mode} disabled={disabled} aria-label={mode === "standard" ? "Standard" : "Freestyle · Chess960"} className={`online-quick-mode online-quick-${mode}`}>
      <legend>{mode === "standard" ? "01 / Standard" : "02 / Freestyle · Chess960"}</legend>
      <div className="online-quick-times">{ONLINE_TIME_CONTROLS.map(minutes => <GameStartButton key={minutes}
        aria-label={`Start ${minutes} minute ${mode === "standard" ? "Standard" : "Freestyle"} game against a human`}
        onClick={() => onStart(minutes, mode)}><span className="online-quick-button-action">Play against human</span><span className="online-quick-button-mode">{mode === "standard" ? "Standard" : <>Freestyle<br />Chess960</>}</span><span className="online-quick-button-time"><strong>{minutes}</strong> min</span></GameStartButton>)}</div>
    </fieldset>)}
  </div>;
}
