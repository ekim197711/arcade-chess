import { ArrowRight, BookOpen, ChevronRight, Gamepad2, History, RefreshCw, Settings, Trophy, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { PlayMode } from "./chess";
import type { Progress } from "./progress";
import { OnlineQuickStart } from "./OnlineQuickStart";
import { OnlineHomeCard } from "./OnlineHomeCard";

type NextBoss = { name: string; elo: number; image?: string };
export function ArenaHome({ userId, playerName, avatar, rating, progress, bosses, refreshToken, refreshing, onRefresh, navigate, onBoss, onHuman, resume, onHelp, administrator }: {
  userId?: string; playerName: string; avatar: ReactNode; rating: ReactNode; progress: Progress;
  bosses: Record<PlayMode, NextBoss>; refreshToken: number; refreshing: boolean; onRefresh: () => void;
  navigate: (route: string) => void; onBoss: (mode: PlayMode) => void; onHuman: (minutes: number, mode: PlayMode) => void;
  resume?: { name: string; onClick: () => void }; onHelp: () => void; administrator: boolean;
}) {
  const [mode, setMode] = useState<PlayMode>("standard");
  const [practice, setPractice] = useState(false);
  const boss = bosses[mode];
  const cleared = mode === "standard" ? progress.bossesDefeated : progress.freestyleBossesDefeated;
  return <div className="arena-home">
    <header className="arena-heading"><div><span className="arena-eyebrow"><i /> THE CHESS ARCADE</span><h1>Your move. <br /><em>Make it count.</em></h1><p>Real opponents. Good games. One more round.</p></div><div className="arena-heading-mark" aria-hidden="true">♞<span>EST. 2026</span></div></header>
    <div className="arena-play-grid">
      <section className="human-arena" aria-labelledby="human-play-title">
        <div className="arena-card-heading"><span className="arena-card-icon"><Users size={22} /></span><div><span className="arena-eyebrow">THE MAIN EVENT</span><h2 id="human-play-title">Play against human</h2></div><span className="arena-status"><i /> ONLINE ARENA</span></div>
        <p className="arena-description">Pick your clock. Find your rival.</p>
        {userId ? <OnlineHomeCard userId={userId} refreshToken={refreshToken} navigate={navigate} /> : <OnlineQuickStart onStart={onHuman} />}
        <div className="arena-fair-play"><span><Zap size={13} /> Matched by rating</span><span>Standard & Chess960</span><span>20s search, then bot practice</span></div>
      </section>
      <section className="ladder-arena" aria-labelledby="home-ladder-title">
        <div className="arena-card-heading"><span className="arena-card-icon"><Trophy size={21} /></span><div><span className="arena-eyebrow">THE SOLO CHALLENGE</span><h2 id="home-ladder-title">Boss ladder</h2></div><span className="rung-total">59 BOSSES</span></div>
        <div className="arena-segmented" role="group" aria-label="Boss ladder variant"><button aria-pressed={mode === "standard"} onClick={() => setMode("standard")}>Standard</button><button aria-pressed={mode === "freestyle"} onClick={() => setMode("freestyle")}>Freestyle</button></div>
        <button className="boss-art-button" onClick={() => onBoss(mode)} aria-label={`Open ${mode} boss ladder, next opponent ${boss.name}`}>
          <div className="boss-art-orbit" aria-hidden="true" />
          {boss.image && <img src={boss.image} alt="" width={112} height={112} />}
          <span className="boss-art-copy"><small>{cleared >= 59 ? "LADDER COMPLETE · PLAY AGAIN" : "YOUR NEXT CHALLENGER"}</small><strong>{boss.name}</strong><span>{boss.elo} <small>LADDER RATING</small></span></span><ArrowRight size={20} />
        </button>
        <div className="ladder-progress"><span>YOUR CLIMB <b>{cleared} / 59</b></span><div role="progressbar" aria-label={`${mode} ladder progress`} aria-valuenow={cleared} aria-valuemin={0} aria-valuemax={59}><i style={{ width: `${cleared / 59 * 100}%` }} /></div></div>
        {resume && <button className="arena-resume" onClick={resume.onClick}>Resume vs. {resume.name}<ChevronRight size={14} /></button>}
      </section>
    </div>
    <div className="arena-bottom-row">
      <section className="arena-player" aria-label="Your progress"><span className="arena-avatar">{avatar}</span><div><strong>{userId ? playerName : "Guest player"}</strong>{rating}</div><span className="arena-record"><b>{progress.wins}</b> WINS</span><span className="arena-record"><b>{progress.streak}</b> STREAK</span>{userId && <button className="arena-refresh" disabled={refreshing} onClick={onRefresh} aria-label="Refresh saved data"><RefreshCw size={14} className={refreshing ? "is-spinning" : ""} /></button>}</section>
      <nav className="arena-tools" aria-label="Game options"><button onClick={() => navigate("history")}><History size={16} /><span>Your games</span></button><button onClick={() => navigate("settings")}><Settings size={16} /><span>Customize</span></button><div className="arena-practice"><button aria-expanded={practice} aria-controls="practice-menu" onClick={() => setPractice(value => !value)}><BookOpen size={16} /><span>Practice</span></button>{practice && <div id="practice-menu" className="practice-menu"><button onClick={() => navigate("gambits")}>Gambit Academy<ArrowRight size={14} /></button><button onClick={() => navigate("starship")}>Starship Rescue<ArrowRight size={14} /></button><button onClick={() => navigate("pinball")}>Chess Pinball<ArrowRight size={14} /></button></div>}</div><button onClick={onHelp}><Gamepad2 size={16} /><span>How to play</span></button>{administrator && <button onClick={() => navigate("administration")}>Admin</button>}</nav>
    </div>
  </div>;
}
