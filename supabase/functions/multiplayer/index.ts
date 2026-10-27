import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
import { botMove, outcome, replay, timeoutResult } from './rules.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Use POST' }, 405);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return respond({ error: 'Sign in to play online' }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user || auth.user.is_anonymous) return respond({ error: 'Sign in to play online' }, 401);
    const user = auth.user;
    const input = await req.json();
    const action = input.action;
    if (action === 'active') {
      const { data: active, error: activeError } = await admin.from('online_games').select('*').is('result',null)
        .or(`white_id.eq.${user.id},black_id.eq.${user.id}`).limit(1).maybeSingle();
      if (activeError) throw activeError;
      if (!active) return respond({ game: null, server_now: new Date().toISOString() });
      // A home-card status check adjudicates expiry without refreshing presence.
      const { data, error } = await admin.rpc('online_commit', {
        p_game: active.id, p_version: active.version, p_actor: user.id,
        p_kind: 'inspect', p_timeout_result: timeoutResult(replay(active.pgn)),
      });
      if (error) throw error;
      return respond({ game: data, server_now: new Date().toISOString() });
    }
    if (action === 'join' || action === 'cancel') {
      if (![3,5,10,15].includes(input.minutes)) return respond({ error: 'Choose 3, 5, 10 or 15 minutes' }, 400);
      const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? 'Player').slice(0,40);
      const { data, error } = await admin.rpc('online_join', { p_user: user.id, p_name: name, p_minutes: input.minutes, p_cancel: action === 'cancel' });
      if (error) throw error;
      return respond({ ...data, server_now: new Date().toISOString() });
    }
    if (!['state','disconnect','move','resign','offer_draw','accept_draw','decline_draw'].includes(action) || typeof input.game_id !== 'string') return respond({ error: 'Invalid action' }, 400);
    const { data: existing, error: readError } = await admin.from('online_games').select('*').eq('id',input.game_id).single();
    if (readError) return respond({ error: 'Game not found' }, 404);
    const participant = existing.white_id === user.id || existing.black_id === user.id;
    if (!participant && (!existing.result || action !== 'state')) return respond({ error: 'This game is private until it finishes' }, 403);
    let stored = existing;
    if (!stored.result && participant) {
      // Update the human's presence before any bot response. The locked RPC
      // adjudicates an expired reconnect window before refreshing the heartbeat.
      const { data: present, error: presenceError } = await admin.rpc('online_commit', {
        p_game: stored.id, p_version: stored.version, p_actor: user.id,
        p_kind: action === 'disconnect' ? 'disconnect' : 'tick', p_timeout_result: timeoutResult(replay(stored.pgn)),
      });
      if (presenceError) throw presenceError;
      stored = present;
      if (stored.result || action === 'disconnect') return respond({ game: stored, server_now: new Date().toISOString() });
      const game = replay(stored.pgn);
      const timeout = timeoutResult(game);
      let kind = action === 'state' ? 'tick' : action;
      let actor: string | null = user.id;
      const params: Record<string, unknown> = {};
      if (action === 'move') {
        if (input.version !== stored.version) return respond({ game: stored, server_now: new Date().toISOString() });
        const turnUser = stored.turn === 'w' ? stored.white_id : stored.black_id;
        if (turnUser !== user.id) return respond({ error: 'Wait for your turn' }, 409);
        if (!/^[a-h][1-8]$/.test(input.from) || !/^[a-h][1-8]$/.test(input.to) || (input.promotion !== undefined && !['q','r','b','n'].includes(input.promotion))) return respond({ error: 'Invalid move' }, 400);
        try { game.move({ from: input.from, to: input.to, promotion: input.promotion }); }
        catch { return respond({ error: 'Illegal move' }, 400); }
        const terminal = outcome(game);
        Object.assign(params, { p_pgn: game.pgn(), p_fen: game.fen(), p_turn: game.turn(), p_result: terminal.result, p_reason: terminal.reason });
      } else if (action === 'state' && stored.is_bot && stored.turn === 'b') {
        const move = botMove(game,stored.black_rating);
        if (move) {
          game.move(move); kind = 'move'; actor = null;
          const terminal = outcome(game);
          Object.assign(params, { p_pgn: game.pgn(), p_fen: game.fen(), p_turn: game.turn(), p_result: terminal.result, p_reason: terminal.reason });
        }
      }
      const { data, error } = await admin.rpc('online_commit', { p_game: stored.id, p_version: stored.version, p_actor: actor, p_kind: kind, p_timeout_result: timeout, ...params });
      if (error) throw error;
      stored = data;
    }
    return respond({ game: stored, server_now: new Date().toISOString() });
  } catch (error) {
    console.error('Multiplayer request failed', error instanceof Error ? error.message : 'Database request failed');
    return respond({ error: 'Online play is temporarily unavailable. Please retry.' }, 503);
  }
});
