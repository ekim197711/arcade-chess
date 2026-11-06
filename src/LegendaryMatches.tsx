import { useDeferredValue, useEffect, useState } from "react";
import { CLASSIC_GAMES, classicPgn } from "./classicGames";
import { GameReview } from "./GameReview";
import type { PieceStyle } from "./PieceArtwork";
import "./historyPage.css";

type Tournament = { id: string; title: string; year: number; count: number; source: string; players: string[] };
type Catalog = { source: string; importedAt: string; gameCount: number; events: Tournament[] };
type HistoricGame = { id: string; white: string; black: string; event: string; date: string; round: string; result: string; opening: string; plies: number; pgn: string };
const PAGE_SIZE = 24;
function matches(text: string, query: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const haystack = normalize(text);
  return normalize(query).trim().split(/\s+/).every(word => haystack.includes(word));
}
function useArchive<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: string }>({path:null});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({path});
    void fetch(path, {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error("Archive could not be loaded.");
      return await response.json() as T;
    }).then(data => { if (!controller.signal.aborted) setState({path,data}); })
      .catch(() => { if (!controller.signal.aborted) setState({path,error:"Archive could not be loaded. Please retry."}); });
    return () => controller.abort();
  }, [path, retry]);
  return {data: state.path === path ? state.data : undefined, error: state.path === path ? state.error : undefined, retry: () => setRetry(value=>value+1)};
}
export default function LegendaryMatches({ route, navigate, theme, light, dark }: {
  route: string; navigate: (route: string) => void; theme: PieceStyle; light: string; dark: string;
}) {
  const [,eventId,gameId] = route.split("/");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const search = useDeferredValue(query);
  const catalog = useArchive<Catalog>("/legendary/catalog.json");
  const tournament = catalog.data?.events.find(event=>event.id === eventId);
  const archive = useArchive<HistoricGame[]>(eventId && eventId !== "classic" ? `/legendary/${eventId}.json` : null);
  useEffect(()=> { setQuery(""); setPage(1); },[eventId]);
  const classic = eventId === "classic" ? CLASSIC_GAMES.find(game=>game.id === gameId) : undefined;
  const selected = archive.data?.find(game=>game.id === gameId);
  const review = classic ? { white:classic.white, black:classic.black, pgn:classicPgn(classic), title:classic.title, detail:`${classic.year} · ${classic.opening}`, source:classic.source, note:classic.note } : selected ? {
    white:selected.white, black:selected.black, pgn:selected.pgn, title:`${selected.white} vs. ${selected.black}`,
    detail:`${selected.event} · ${selected.date} · Round ${selected.round} · ${selected.result}`, source:tournament?.source, note:undefined,
  } : undefined;
  const back = () => navigate(eventId === "classic" ? "legendary" : `legendary/${eventId}`);
  if (gameId && review) return <>
    <header className="history-library-heading"><div><h1>{review.title}</h1><p>{review.detail}</p>{review.note && <p>{review.note}</p>}{review.source && <a href={review.source} target="_blank" rel="noreferrer">Original game source</a>}</div></header>
    <GameReview key={`${eventId}/${gameId}`} pgn={review.pgn} playerName={review.white} opponent={review.black} opponentKind="human" opponentElo={null} color="w" theme={theme} light={light} dark={dark} closeLabel="Back to legendary matches" onClose={back} />
  </>;
  const error = eventId && eventId !== "classic" ? archive.error : catalog.error;
  if (gameId) return <section className="game-review"><h1>Legendary matches</h1>{error ? <p role="alert">{error} <button onClick={archive.retry}>Retry</button></p> : eventId !== "classic" && !archive.data ? <p role="status">Loading game…</p> : <p>Game not found in this collection.</p>}<button onClick={back}>Back to legendary matches</button></section>;
  const games = archive.data?.filter(game=>matches(`${game.white} ${game.black} ${game.event} ${game.date} ${game.round} ${game.result} ${game.opening}`,search)) ?? [];
  const events = catalog.data?.events.filter(event=>matches(`${event.title} ${event.year} ${event.players.join(" ")}`,search)) ?? [];
  const count = eventId ? games.length : events.length;
  return <div className="history-library legendary-library">
    <header className="history-library-heading"><div><p className="section-kicker">THE CHESS ARCHIVE</p><h1>Legendary matches</h1><p>{eventId ? tournament?.title ?? "Tournament collection" : "Replay the great games. Discover the moves that made history."}</p></div><button onClick={()=>navigate(eventId ? "legendary" : "home")}>{eventId ? "All tournaments" : "Back to arcade"}</button></header>
    <section className="game-review" aria-label="Legendary matches archive">
      {!eventId && <><p className="review-note">{catalog.data ? `${catalog.data.gameCount.toLocaleString()} games across ${catalog.data.events.length.toLocaleString()} tournaments and championship matches.` : "Historic tournaments and World Championship matches."} Original game scores from <a href="https://www.pgnmentor.com/files.html" target="_blank" rel="noreferrer">PGN Mentor</a>. Choose a tournament, then replay and analyse any game.</p>
      <h2>Famous classics</h2><div className="classic-game-grid">{CLASSIC_GAMES.map(game=><article className="classic-game-card" key={game.id}><small>{game.year} · {game.opening}</small><h3>{game.title}</h3><p>{game.white} vs. {game.black}</p><a href={`#legendary/classic/${game.id}`}>Replay & analyse →</a></article>)}</div><h2>Tournament archive</h2></>}
      {tournament && <p className="review-note">{tournament.count.toLocaleString()} games · <a href={tournament.source} target="_blank" rel="noreferrer">Original tournament PGN</a></p>}
      <label className="classic-search">{eventId ? "Search tournament games" : "Search tournaments or players"}<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder={eventId ? "Player, round, opening code or result" : "Try Fischer, Hastings, 1972 or World Championship"} /></label>
      {error && <p role="alert">{error} <button onClick={eventId ? archive.retry : catalog.retry}>Retry</button></p>}
      {!(eventId ? archive.data : catalog.data) && !error ? <p role="status">Loading archive…</p> : <p role="status">{count.toLocaleString()} {eventId ? "games" : "tournaments"} found</p>}
      {count === 0 && (eventId ? archive.data : catalog.data) && <p>No matches. Try another player, tournament or year.</p>}
      <div className="classic-game-grid">{eventId ? games.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(game=><article className="classic-game-card" key={game.id}><small>{game.date} · Round {game.round}</small><h3>{game.white} <span className="review-note">vs.</span> {game.black}</h3><p>{game.result} · {Math.ceil(game.plies/2)} moves{game.opening && ` · ${game.opening}`}</p><a href={`#legendary/${eventId}/${game.id}`}>Replay & analyse →</a></article>) : events.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(event=><article className="classic-game-card" key={event.id}><small>{event.year} · {event.count.toLocaleString()} games</small><h3>{event.title}</h3><p>{event.players.slice(0,4).join(" · ")}{event.players.length>4 ? " …" : ""}</p><a href={`#legendary/${event.id}`}>Explore tournament →</a></article>)}</div>
      {count>PAGE_SIZE && <nav className="legendary-pagination" aria-label="Archive pages"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.ceil(count/PAGE_SIZE)}</span><button disabled={page*PAGE_SIZE>=count} onClick={()=>setPage(value=>value+1)}>Next</button></nav>}
    </section>
  </div>;
}
