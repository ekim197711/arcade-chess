import { useState, type ReactNode } from "react";
import { CLASSIC_GAMES, classicPgn } from "./classicGames";
import { GameReview } from "./GameReview";
import type { PieceStyle } from "./PieceArtwork";
import "./historyPage.css";

export function HistoryPage({ children, route, navigate, theme, light, dark }: {
  children: ReactNode; route: string; navigate: (route: string) => void;
  theme: PieceStyle; light: string; dark: string;
}) {
  const [query, setQuery] = useState("");
  const classicId = route.split("/")[2];
  const selected = CLASSIC_GAMES.find(game => game.id === classicId);
  const words = query.toLowerCase().trim().split(/\s+/);
  const results = CLASSIC_GAMES.filter(game => words.every(word => `${game.title} ${game.white} ${game.black} ${game.year} ${game.opening}`.toLowerCase().includes(word)));
  if (classicId) return selected ? <>
    <div className="history-library-heading"><h1>{selected.title} · {selected.year}</h1>{selected.note && <p>{selected.note}</p>}<a href={selected.source} target="_blank" rel="noreferrer">Game source</a></div>
    <GameReview key={selected.id} pgn={classicPgn(selected)} playerName={selected.white} opponent={selected.black} opponentKind="human" opponentElo={null} color="w" theme={theme} light={light} dark={dark} closeLabel="Back to game history" onClose={() => navigate("history")} />
  </> : <section className="game-review"><h1>Historic game not found</h1><button onClick={() => navigate("history")}>Back to game history</button></section>;
  return <div className="history-library">
    <header className="history-library-heading"><div><h1>Game history</h1><p>Your battles and classics from chess history.</p></div><button onClick={() => navigate("home")}>Back to arcade</button></header>
    {children}
    <section className="game-review" aria-labelledby="classic-games-title">
      <h2 id="classic-games-title">Historic chess battles</h2>
      <p className="review-note">Explore a starter collection of {CLASSIC_GAMES.length} classic games. Search by player, game name, year or opening.</p>
      <label className="classic-search">Search historic battles<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try Morphy, 1851 or Evans Gambit" /></label>
      <p role="status">{results.length} {results.length === 1 ? "game" : "games"} found</p>
      {results.length === 0 && <p>No historic games match. Try another player, year or opening.</p>}
      <div className="classic-game-grid">{results.map(game => <article className="classic-game-card" key={game.id}>
        <small>{game.year} · {game.opening}</small><h3>{game.title}</h3><p>{game.white} vs. {game.black}</p>
        {game.note && <p className="review-note">{game.note}</p>}
        <div className="history-actions"><a href={`#history/classic/${game.id}`}>Replay game →</a><a href={game.source} target="_blank" rel="noreferrer">Source</a></div>
      </article>)}</div>
    </section>
  </div>;
}
