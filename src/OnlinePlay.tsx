import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Chess, type Square } from "./chess";
import { supabase, supabaseConfiguration } from "./supabase";
import { PieceArtwork, type PieceStyle } from "./PieceArtwork";
import { DragSquare } from "./DragSquare";
import { BoardResizeHandle } from "./BoardResizeHandle";
import { BoardAnnotations } from "./BoardAnnotations";
import type { BoardSound } from "./soundThemes";
import { PromotionMenu, type PromotionPiece } from "./PromotionMenu";
import { premoveBoard, usePremoveQueue } from "./premoves";
import { GameReview } from "./GameReview";
import { OnlineResult } from "./OnlineResult";
import { OnlineSocial } from "./OnlineSocial";
import { clockRemaining, formatClock, reconnectDeadline, predictOnlineMove, predictionWasSaved, ONLINE_TIME_CONTROLS, type OnlineGame, type OnlineProfile, type OnlinePremove, type OnlineMovePrediction } from "./onlineChess";
import "./online.css";
import { invalidateHomeData } from "./homeDataCache";

type Reply = { game?: OnlineGame | null; profile?: OnlineProfile; queued?: boolean; fallback_at?: string; server_now: string; error?: string; edge_required?: boolean;
  presence?: Pick<OnlineGame,"version"|"white_seen_at"|"black_seen_at"|"white_disconnected_at"|"black_disconnected_at"> & { game_id: string } };
type Props = {
  userId: string; route: string; navigate: (route: string) => void; theme: PieceStyle; light: string; dark: string;
  appearance: ReactNode; boardWidth?: number; onBoardResize: (width: number | undefined) => void; loadingPieceStyle: boolean;
  onSound: (sound: BoardSound) => void;
  onMoveSound: (move: ReturnType<Chess["move"]>, position: Chess, side: "w" | "b") => void;
};
export function OnlinePlay({ userId, route, navigate, theme, light, dark, appearance, boardWidth, onBoardResize, loadingPieceStyle, onSound, onMoveSound }: Props) {
  const parts = route.split("/");
  const reviewing = parts[1] === "review";
  const newMatch = parts[1] === "new";
  const gameId = reviewing ? parts[2] : newMatch ? undefined : parts[1];
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [profile, setProfile] = useState<OnlineProfile | null>(null);
  const [minutes, setMinutes] = useState(newMatch && ONLINE_TIME_CONTROLS.some(time => time === Number(parts[2])) ? Number(parts[2]) : 5);
  const [queued, setQueued] = useState(false);
  const [fallbackAt, setFallbackAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<OnlineGame[]>([]);
  const [historyMode, setHistoryMode] = useState<"mine" | "community">("mine");
  const [historyLimit, setHistoryLimit] = useState(20);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square; x: number; y: number; queued?: boolean } | null>(null);
  const [resignConfirm, setResignConfirm] = useState(false);
  const { premoves, setPremoves, takePremove } = usePremoveQueue<OnlinePremove>();
  const [notice, setNotice] = useState("");
  const [prediction, setPrediction] = useState<OnlineMovePrediction | null>(null);
  const predictionRef = useRef<OnlineMovePrediction | null>(null);
  const soundedPrediction = useRef<OnlineMovePrediction | null>(null);
  function updatePrediction(next: OnlineMovePrediction | null) { predictionRef.current = next; setPrediction(next); }
  const gameRef = useRef(game); gameRef.current = game;
  const tokenRef = useRef<string | null>(null);
  const pendingRequest = useRef<Promise<void> | null>(null);
  const soundPosition = useRef<OnlineGame | null>(null);
  const inFlight = useRef(false), mounted = useRef(true), offset = useRef(0), queueRef = useRef(false);
  const minutesRef = useRef(minutes); minutesRef.current = minutes;
  const nextRefreshAt = useRef(0), refreshFailures = useRef(0), manualReconnect = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      invalidateHomeData(userId);
      if (queueRef.current) void supabase?.rpc("online_matchmake", { p_cancel: true, p_minutes: minutesRef.current });
    };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()+offset.current),200); return () => clearInterval(timer); }, []);

  useEffect(() => {
    let active = true;
    void supabase?.auth.getSession().then(({ data }) => { if (active) tokenRef.current = data.session?.access_token ?? null; });
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => { tokenRef.current = session?.access_token ?? null; }).data.subscription;
    const disconnect = () => {
      const current = gameRef.current;
      if (!current || current.result || reviewing || !tokenRef.current) return;
      // Browser close is best effort. Missing heartbeats enforce the same deadline
      // if the browser is killed or the network disappears without this event.
      void fetch(`${supabaseConfiguration.url}/rest/v1/rpc/online_disconnect`, {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: supabaseConfiguration.key, Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ p_game: current.id }),
      }).catch(() => {});
    };
    const offline = () => setError("Connection lost. Reconnect within 20 seconds to avoid forfeiting.");
    window.addEventListener("pagehide", disconnect);
    window.addEventListener("offline", offline);
    return () => { active = false; subscription?.unsubscribe(); window.removeEventListener("pagehide", disconnect); window.removeEventListener("offline", offline); };
  }, [reviewing]);

  async function request(action: string, extra: Record<string, unknown> = {}, background = false): Promise<void> {
    if (!supabase) return;
    const refresh = action === "state" || action === "join";
    if (background && refresh && (manualReconnect.current || Date.now() < nextRefreshAt.current)) return;
    const mutation = action !== "state";
    if (inFlight.current) {
      if (!mutation) return;
      await pendingRequest.current;
      if (!mounted.current) return;
      return request(action, extra, background);
    }
    if (action === "move" && !predictionRef.current) return;
    let release!: () => void;
    pendingRequest.current = new Promise<void>(resolve => { release = resolve; });
    inFlight.current = true; if (mutation) setBusy(true);
    if (refresh) nextRefreshAt.current = Date.now() + 2000;
    let rejected = false;
    try {
      let response;
      if (action === "state") {
        const current = gameRef.current;
        response = await supabase.rpc("online_state", { p_game: gameId,
          p_version: predictionRef.current?.status !== "uncertain" && current && current.id === gameId ? current.version : null });
        if (!response.error && response.data?.edge_required) {
          response = await supabase.functions.invoke<Reply>("multiplayer", { body: { action: "state", game_id: gameId } });
        }
      } else if (action === "join" || action === "cancel") {
        response = await supabase.rpc("online_matchmake", { p_minutes: minutes, p_cancel: action === "cancel" });
      } else response = await supabase.functions.invoke<Reply>("multiplayer", { body: { action, minutes, game_id: gameId, ...extra } });
      const data = response.data as Reply | null, failure = response.error;
      if (failure || !data || data.error) {
        let message = data?.error ?? (failure as { message?: string } | null)?.message;
        const code = (failure as { code?: string } | null)?.code ?? "";
        if (refresh && (code.startsWith("22") || ["42501", "PGRST202", "PGRST301", "PGRST302"].includes(code))) manualReconnect.current = true;
        const response = (failure as { context?: Response } | null)?.context;
        if (response instanceof Response) {
          rejected = response.status >= 400 && response.status < 500;
          if (rejected && refresh) manualReconnect.current = true;
          try { message = (await response.clone().json()).error ?? message; } catch { /* Keep the connection message. */ }
        }
        throw new Error(message ?? "Connection interrupted. Reconnect within 20 seconds; clocks keep running.");
      }
      if (!mounted.current) return;
      refreshFailures.current = 0; manualReconnect.current = false;
      offset.current = Date.parse(data.server_now)-Date.now(); setNow(Date.parse(data.server_now)); setError("");
      if (data.presence) {
        const { game_id, ...presence } = data.presence;
        setGame(current => current?.id === game_id && current.version === presence.version ? { ...current, ...presence } : current);
      }
      if (data.profile) setProfile(data.profile);
      if (data.game) {
        const next = data.game;
        queueRef.current = false; setQueued(false); setFallbackAt(null);
        setGame(current => current?.id === next.id && current.version>next.version ? current : next);
        const pending = predictionRef.current;
        if (pending && pending.base.id === next.id) {
          const saved = predictionWasSaved(pending, next);
          if (saved || next.result || action === "move" || pending.status === "uncertain") {
            updatePrediction(null);
            if (!saved) {
              setPremoves([]);
              soundedPrediction.current = null;
              if (!next.result) { setNotice("Move was not saved. The confirmed position has been restored; please choose your move again."); onSound("invalid"); }
            }
          }
        }
        if ((action === "join" || action === "cancel") && !gameId) navigate(`online/${next.id}`);
      } else if (data.queued !== undefined) {
        queueRef.current = data.queued; setQueued(data.queued);
        setFallbackAt(data.fallback_at ? Date.parse(data.fallback_at) : null);
      }
    } catch (failure) {
      if (refresh) {
        refreshFailures.current += 1;
        nextRefreshAt.current = Date.now() + Math.min(10_000, 2000 * 2 ** Math.min(refreshFailures.current - 1, 3));
      }
      if (mounted.current) {
        const message = failure instanceof Error ? failure.message : "Online play unavailable. Please retry.";
        if (action === "move" && predictionRef.current) {
          if (rejected) {
            setPremoves([]);
            updatePrediction(null); soundedPrediction.current = null; setNotice(`${message}. The confirmed position has been restored.`); onSound("invalid"); setError("");
          } else { updatePrediction({ ...predictionRef.current, status: "uncertain" }); setError(message); }
        } else setError(message);
      }
    } finally { inFlight.current = false; release(); if (mounted.current) { if (mutation) setBusy(false); setLoading(false); } }
  }
  useEffect(() => {
    let active = true;
    setGame(null); updatePrediction(null); soundedPrediction.current = null; setSelected(null); setPromotion(null); setPremoves([]); setResignConfirm(false); setLoading(true); setError(""); soundPosition.current = null;
    nextRefreshAt.current=0; refreshFailures.current=0; manualReconnect.current=false;
    if (gameId) { void request("state"); return; }
    void (async () => {
      const [player, activeGame] = await Promise.all([
        supabase!.from("online_players").select("*").eq("user_id",userId).maybeSingle(),
        supabase!.from("online_games").select("*").is("result",null).or(`white_id.eq.${userId},black_id.eq.${userId}`).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      if (player.error || activeGame.error) setError("Online play is unavailable. Please retry.");
      else {
        setProfile(player.data as OnlineProfile | null);
        if (activeGame.data) { navigate(`online/${activeGame.data.id}`); return; }
        if (newMatch) { await request("join"); return; }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [gameId, userId]);
  useEffect(() => {
    if (reviewing || (!queued && (!gameId || game?.result))) return;
    const timer = window.setInterval(() => void request(queued ? "join" : "state", {}, true), 2000);
    const focus = () => void request(queued ? "join" : "state", {}, true);
    window.addEventListener("online",focus); window.addEventListener("focus",focus); window.addEventListener("pageshow",focus);
    return () => { clearInterval(timer); window.removeEventListener("online",focus); window.removeEventListener("focus",focus); window.removeEventListener("pageshow",focus); };
  }, [queued, gameId, game?.result, reviewing, minutes]);
  useEffect(() => {
    if (gameId) return;
    let active = true; setHistoryLoading(true);
    let query = supabase!.from("online_games").select("*").not("result","is",null).order("finished_at",{ ascending: false }).limit(historyLimit);
    if (historyMode === "mine") query = query.or(`white_id.eq.${userId},black_id.eq.${userId}`);
    void query.then(({ data, error: failure }) => {
      if (!active) return; setHistoryLoading(false);
      if (failure) setError("Could not load online history. Please retry."); else setHistory(data as OnlineGame[]);
    });
    return () => { active = false; };
  }, [gameId, historyMode, historyLimit, userId]);
  const displayGame = prediction?.game ?? game;
  useEffect(() => { setPromotion(null); }, [displayGame?.fen]);
  const confirmedPosition = useMemo(() => { const chess = new Chess(); if (game?.pgn) chess.loadPgn(game.pgn); return chess; },[game?.pgn]);
  const confirmedMoves = useMemo(() => confirmedPosition.history({ verbose: true }), [confirmedPosition]);
  const position = useMemo(() => { if (!prediction) return confirmedPosition; const chess = new Chess(); chess.loadPgn(prediction.game.pgn); return chess; }, [confirmedPosition, prediction]);
  const moveHistory = useMemo(() => position.history({ verbose: true }), [position]);
  const side = game?.black_id === userId ? "b" : "w";
  const participant = game?.white_id === userId || game?.black_id === userId;
  const canMove = !!game && participant && !game.result && game.turn === side && !prediction && !busy && !error;
  const canInteract = !!game && participant && !game.result && (!busy || !!prediction) && !error && !reviewing;
  const premoveTurn = canInteract && displayGame?.turn !== side;
  const plannedBoard = useMemo(() => premoveBoard(position, promotion?.queued ? [promotion, ...premoves] : premoves, side), [position, premoves, promotion, side]);
  const queuingPremove = premoveTurn || premoves.length > 0;
  useEffect(() => {
    setSelected(square => square && plannedBoard.get(square)?.color === side ? square : null);
  }, [plannedBoard, side]);
  const legal = selected ? queuingPremove ? plannedBoard.targets(selected) : position.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  const lastMove = moveHistory.at(-1);
  const opponentSide = side === "w" ? "b" : "w";
  const opponentDeadline = game ? reconnectDeadline(game, opponentSide) : null;
  const opponentSeen = game ? Date.parse(opponentSide === "w" ? game.white_seen_at : game.black_seen_at) : now;
  const opponentDisconnected = game && (opponentSide === "w" ? game.white_disconnected_at : game.black_disconnected_at);
  const opponentReconnecting = opponentDeadline !== null && (!!opponentDisconnected || now - opponentSeen > 6000);

  useEffect(() => {
    const previous = soundPosition.current;
    soundPosition.current = game;
    if (!game || !previous || previous.id !== game.id || reviewing) return;
    if (game.ply_count > previous.ply_count) {
      for (const [index, move] of confirmedMoves.entries()) {
        if (index < previous.ply_count) continue;
        const sounded = soundedPrediction.current;
        if (sounded && index === sounded.base.ply_count && move.from === sounded.move.from && move.to === sounded.move.to && move.promotion === sounded.move.promotion) soundedPrediction.current = null;
        else onMoveSound(move, new Chess(move.after), side);
      }
    }
    if (game.result && !previous.result) {
      if (game.reason === "Time expired") onSound("timeout");
      onSound(game.result === "1/2-1/2" ? "move" : game.result === (side === "w" ? "1-0" : "0-1") ? "win" : "lose");
    }
  }, [game, confirmedMoves, reviewing, side, onMoveSound, onSound]);

  function makeMove(from: Square, to: Square, x?: number, y?: number, promotionPiece?: PromotionPiece, executeQueued = false) {
    if (!canInteract) return false;
    if (!executeQueued && queuingPremove) {
      if (plannedBoard.get(from)?.color !== side || !plannedBoard.targets(from).includes(to)) return false;
      setPremoves(previous => [...previous, { from, to, x, y }]); setSelected(null); setNotice(""); onSound("select");
      return true;
    }
    const candidate = position.moves({ square: from, verbose: true }).find(move => move.to === to);
    if (!candidate) { onSound("invalid"); return false; }
    if (candidate.promotion && !promotionPiece) {
      const target = document.querySelector(`.online-board [data-square="${to}"]`)?.getBoundingClientRect();
      setPromotion({ from, to, x: x ?? (target ? target.x + target.width/2 : innerWidth/2), y: y ?? (target ? target.y + target.height/2 : innerHeight/2), queued: executeQueued });
    } else {
      if (predictionRef.current) return false;
      const optimistic = predictOnlineMove(game!, { from, to, ...(promotionPiece ? { promotion: promotionPiece } : {}) }, Date.now() + offset.current);
      updatePrediction(optimistic); soundedPrediction.current = optimistic; setNotice(""); setPromotion(null);
      onMoveSound(optimistic.move, new Chess(optimistic.move.after), side);
      void request("move", { from, to, ...(promotionPiece ? { promotion: promotionPiece } : {}), version: optimistic.base.version });
    }
    if (!executeQueued) setSelected(null); return true;
  }
  function moveTo(square: Square, x: number, y: number) {
    if (!canInteract || promotion) return;
    if (selected && legal.includes(square)) makeMove(selected, square, x, y);
    else {
      const own = plannedBoard.get(square)?.color === side;
      if (own && selected !== square) onSound("select");
      setSelected(own && selected !== square ? square : null);
    }
  }
  useEffect(() => {
    if (!premoves.length) return;
    if (game?.result) { setPremoves([]); return; }
    if (!canMove || promotion || predictionRef.current) return;
    const queuedMove = takePremove(`${game!.id}:${game!.fen}`);
    if (!queuedMove) return;
    if (!makeMove(queuedMove.from, queuedMove.to, queuedMove.x, queuedMove.y, undefined, true)) {
      setPremoves([]);
      setNotice("Premoves canceled: the next move is no longer legal.");
    }
  }, [game?.fen, game?.result, canMove, premoves, promotion]);
  if (reviewing && game && !game.result) return <section className="game-review"><h2>Game still in progress</h2><p>Analysis becomes available when the game is complete.</p><button onClick={() => navigate(`online/${game.id}`)}>Resume match</button></section>;
  if (reviewing && game) return <GameReview pgn={game.pgn} moveTimesMs={game.move_times_ms} timingSource="server" playerName={side === "w" ? game.white_name : game.black_name} opponent={side === "w" ? game.black_name : game.white_name} opponentElo={side === "w" ? game.black_rating : game.white_rating} opponentKind={game.is_bot ? "bot" : "human"} theme={theme} color={side} light={light} dark={dark} onClose={() => navigate("online")} closeLabel="Back to online play" onMoveSound={(move, position) => onMoveSound(move, position, side)} />;
  if (game?.result && !reviewing) return <OnlineResult game={game} userId={userId} theme={theme} light={light} dark={dark} onReview={() => navigate(`online/review/${game.id}`)} onPlayAgain={() => navigate(`online/new/${game.minutes}`)} onChooseTime={() => navigate("online")} onHome={() => navigate("home")} />;
  return <section className={`online-play ${game && !reviewing ? "online-battle" : "game-review"}`} aria-labelledby="online-title">
    <header><div><h2 id="online-title">Play against human</h2><p className="review-note">{profile ? `${profile.rating} overall Elo · ${profile.rated_games} rated games` : game ? `${side === "w" ? game.white_rating+game.white_delta : game.black_rating+game.black_delta} overall Elo` : "Overall Elo starts at 1200"}</p></div><button onClick={() => navigate("home")}>Back to home</button></header>
    {error && <p className="online-error" role="alert">{error} <button disabled={busy} onClick={() => void request(gameId ? "state" : queued ? "join" : "cancel")}>Reconnect</button></p>}
    {loading && <p role="status">Connecting to the arena…</p>}
    {!gameId && <>
      <div className="online-lobby"><h3>Find your next opponent</h3>
        <fieldset disabled={queued || busy || loading}><legend>Minutes per player · no increment</legend><div className="online-times">{ONLINE_TIME_CONTROLS.map(time => <button key={time} aria-pressed={minutes === time} onClick={() => setMinutes(time)}>{time} min</button>)}</div></fieldset>
        <p>We match the closest overall Elo among available players using the same clock. If nobody is available after 20 seconds, you’ll play an unrated practice bot.</p><p className="review-note">Completed online games, names and ratings are visible to other signed-in players.</p>
        {queued ? <><p role="status">Looking for a human opponent… Bot fallback in {Math.max(0,Math.ceil(((fallbackAt ?? now)-now)/1000))} seconds.</p><button disabled={busy} onClick={() => void request("cancel")}>Cancel search</button></> : <button className="online-primary" disabled={busy || loading || !!error} onClick={() => void request("join")}>Find opponent</button>}
      </div>
      <details className="review-skill-method"><summary>How online Elo works</summary><p>Arcade Gambit uses one overall online rating, initially 1200. Human games use the FIDE expected-score table, a 400-point difference cap and ΔR = K × (score − expected score). A win scores 1, a draw ½, and a loss 0. K is 40 for your first 30 rated games, then 20, or 10 once you have reached 2400. Changes round to the nearest integer, with halves away from zero.</p><p>This is an internal online rating, not an official FIDE rating. We use adult K rules, update after each game rather than monthly, and share a pool across all four clocks. Bot games and games where both sides have not moved are unrated. Games with a gap of at least 600 are also unrated if either rating is above 2600.</p><p><a href="https://handbook.fide.com/chapter/B02RBRegulations2024" target="_blank" rel="noreferrer">FIDE rapid and blitz rating regulations</a></p></details>
      <OnlineSocial userId={userId} />
      <section className="online-history" aria-labelledby="online-history-title"><h3 id="online-history-title">Online game history</h3><div className="online-times" role="group" aria-label="History filter"><button aria-pressed={historyMode === "mine"} onClick={() => { setHistoryMode("mine"); setHistoryLimit(20); }}>Your games</button><button aria-pressed={historyMode === "community"} onClick={() => { setHistoryMode("community"); setHistoryLimit(20); }}>Community games</button></div>
        {historyLoading ? <p role="status">Loading games…</p> : !history.length ? <p>No completed games yet.</p> : <div className="history-list">{history.map(item => <div className="history-item" key={item.id}><span><strong>{item.white_name} vs. {item.black_name}</strong><small>{item.minutes}+0 · {item.is_bot ? "Bot practice" : item.rated ? "Rated human game" : "Unrated human game"} · {new Date(item.finished_at!).toLocaleString()}</small><small>White {item.white_rating} ({item.white_delta>=0 ? "+" : ""}{item.white_delta}) · Black {item.black_rating} ({item.black_delta>=0 ? "+" : ""}{item.black_delta})</small></span><strong>{item.result}</strong><a href={`#online/review/${item.id}`}>Analyze & replay</a></div>)}</div>}
        {history.length >= historyLimit && <button disabled={historyLoading} onClick={() => setHistoryLimit(limit => limit+20)}>Load older games</button>}
      </section>
    </>}
    {game && !reviewing && <>
      <p className="online-game-type">{game.is_bot ? "No human found · Unrated bot practice" : "Human match · Online Elo"} · {game.minutes}+0 · You play {side === "w" ? "White" : "Black"}</p>
      <div className="online-game-layout"><aside className="online-communication" aria-label="Game chat and emojis"><OnlineSocial userId={userId} game={game} /></aside><article className="cabinet online-cabinet" aria-label="Chess game">
        {([side === "w" ? "b" : "w",side] as const).map((clockSide,index) => <div key={clockSide} className={`online-clock ${displayGame?.turn === clockSide ? "online-clock-active" : ""} ${index === 0 ? "online-clock-opponent" : "online-clock-you"}`}><span>{clockSide === "w" ? game.white_name : game.black_name}<small>{clockSide === "w" ? game.white_rating : game.black_rating} Elo</small></span><time aria-label={`${clockSide === "w" ? "White" : "Black"} clock`}>{formatClock(clockRemaining(displayGame!,clockSide,now))}</time></div>)}
        <div className="board-stage online-board-stage"><div className="board-frame" style={{ "--board-square-light": light, "--board-square-dark": dark, "--board-width": boardWidth === undefined ? undefined : `${boardWidth}px` } as CSSProperties}>
        <div className="board-coordinates board-files-top">{Array.from({length:8},(_,index) => <span key={index}>{String.fromCharCode(97+(side === "w" ? index : 7-index))}</span>)}</div>
        <div className="board-wrap"><div className="board-coordinates board-ranks">{Array.from({length:8},(_,index) => <span key={index}>{side === "w" ? 8-index : 1+index}</span>)}</div>
        <div className="online-board chessboard" role="group" aria-label="Online chessboard" onKeyDown={event => { if (event.key === "Escape") { setPremoves([]); setSelected(null); setPromotion(null); } }}>
          <BoardAnnotations color={side} positionKey={`${game.id}:${position.fen()}`} onCancelPremoves={() => { setPremoves([]); setSelected(null); setPromotion(null); }} />
          {Array.from({length:64},(_,index) => {
            const file=side === "w" ? index%8 : 7-index%8; const rank=side === "w" ? 8-Math.floor(index/8) : 1+Math.floor(index/8);
            const square=`${String.fromCharCode(97+file)}${rank}` as Square; const piece=plannedBoard.get(square); const target=legal.includes(square);
            return <DragSquare key={square} square={square} positionKey={`${game.id}:${piece?.color}:${piece?.type}`} canDrag={canInteract && !promotion && piece?.color === side}
              artwork={piece && <PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare />}
              onPickUp={() => { onSound("select"); setSelected(square); }}
              onMovePiece={(from, to, anchor) => { makeMove(from, to, anchor.x, anchor.y); }}
              className={`square square-${(file+rank)%2 === 0 ? "light" : "dark"}${square === selected ? " square-selected" : ""}${lastMove?.from === square || lastMove?.to === square ? " square-last" : ""}${target ? " square-target" : ""}${target && queuingPremove ? " square-premove-target" : ""}${premoves.some(move => move.from === square) ? " square-premove-from" : ""}${premoves.some(move => move.to === square) ? " square-premove-to" : ""} ${piece?.color === "w" ? "piece-white" : "piece-black"}`}
              aria-label={`${square}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""}${target ? queuingPremove ? " premove destination" : " legal destination" : ""}${premoves.some(move => move.from === square) ? " premove origin" : ""}${premoves.some(move => move.to === square) ? " premove target" : ""}`}
              aria-pressed={square === selected} disabled={!canInteract} onClick={event => moveTo(square,event.clientX,event.clientY)}>
              {piece && <span className={`chess-piece ${piece.color === "w" ? "white-piece-glyph" : "black-piece-glyph"}`}><PieceArtwork type={piece.type} color={piece.color} theme={theme} fitToSquare /></span>}
              {target && <span className={`move-dot ${piece ? "move-capture" : ""}`} />}
            </DragSquare>;
          })}
        </div></div>
        <div className="board-coordinates board-files-bottom">{Array.from({length:8},(_,index) => <span key={index}>{String.fromCharCode(97+(side === "w" ? index : 7-index))}</span>)}</div>
        {loadingPieceStyle && <div className="piece-style-loading" role="status"><span className="piece-style-spinner" aria-hidden="true" /><span>Please wait</span></div>}
        <BoardResizeHandle onResize={onBoardResize} fitToStageHeight={false} />
        </div></div>
      </article><aside className="online-game-info side-panel">
        <p role="status">{error ? "Reconnecting; both clocks continue." : prediction ? prediction.status === "saving" ? "Saving move…" : "Move shown locally; reconnecting to confirm…" : displayGame?.turn === side ? "Your move" : game.is_bot ? "Bot is thinking…" : "Waiting for opponent…"}</p>
        {opponentReconnecting && <p className="online-reconnecting" role="status">Opponent reconnecting · {Math.max(0,Math.ceil((opponentDeadline!-now)/1000))} seconds remaining</p>}
        {error && game && !game.result && <p role="status">Reconnect window: {Math.max(0, Math.ceil(((reconnectDeadline(game,side) ?? now)-now)/1000))} seconds remaining.</p>}
        {!game.result && <p className="review-note">Moves save automatically. After closing the browser or disconnecting, return within 20 seconds or forfeit. Your clock keeps running. During your opponent’s turn, select or drag a piece to queue moves. Keep selecting pieces to add more premoves; right-click or press Escape to cancel all. Right-drag between squares to draw translucent arrows; click to clear them.</p>}
        {premoves.length > 0 && <button className="premove-cancel" onClick={() => { setPremoves([]); setSelected(null); setPromotion(null); }} aria-label={premoves.length === 1 ? "Cancel premove" : `Cancel all ${premoves.length} premoves`}>{premoves.length} PREMOVE{premoves.length === 1 ? "" : "S"}: {premoves.map(move => `${move.from}\u2192${move.to}`).join(" / ")} - CANCEL</button>}
        {notice && <p role="status">{notice}</p>}
          {!game.is_bot && !game.draw_offer && <button disabled={busy} onClick={() => void request("offer_draw")}>Offer draw</button>}
          {game.draw_offer && game.draw_offer !== userId && <><p>Opponent offered a draw.</p><button disabled={busy} onClick={() => void request("accept_draw")}>Accept draw</button><button disabled={busy} onClick={() => void request("decline_draw")}>Decline draw</button></>}
          {game.draw_offer === userId && <p>Draw offer sent.</p>}
          {resignConfirm ? <div><p>Resign this game?</p><button disabled={busy} onClick={() => void request("resign")}>Confirm resignation</button><button onClick={() => setResignConfirm(false)}>Keep playing</button></div> : <button disabled={busy} onClick={() => setResignConfirm(true)}>Resign</button>}
        <h3>Moves</h3><ol className="online-moves">{moveHistory.map((move,index) => <li key={index}>{Math.floor(index/2)+1}{index%2 ? "…" : "."} {move.san}</li>)}</ol>
        <div className="online-captures" aria-label="Captured pieces">
          {(["w", "b"] as const).map(color => <div key={color}>
            <span>{color === "w" ? "WHITE" : "BLACK"} LOST</span>
            <div>{(["q", "r", "b", "n", "p"] as const).flatMap(type => {
              const count = moveHistory.filter(move => move.captured === type && move.color !== color).length;
              return Array.from({length:count},(_,index) => <span key={`${type}-${index}`} className="online-captured-piece" role="img" aria-label={`${color === "w" ? "White" : "Black"} ${type} captured`}><PieceArtwork type={type} color={color} theme={theme} /></span>);
            })}</div>
          </div>)}
        </div>
        <details className="online-appearance"><summary>Board, pieces &amp; sound</summary>{appearance}</details>
      </aside></div>
      {promotion && canMove && <PromotionMenu position={promotion} color={side} theme={theme} onCancel={() => { setPromotion(null); setPremoves([]); }} onChoose={(piece: PromotionPiece) => { makeMove(promotion.from,promotion.to,promotion.x,promotion.y,piece,promotion.queued); setPromotion(null); }} />}
    </>}
  </section>;
}
