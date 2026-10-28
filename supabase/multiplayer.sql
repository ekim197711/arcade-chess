-- Run after schema.sql. Only the authenticated Edge Function can mutate play/rating data.
begin;
create table if not exists public.online_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  rating integer not null default 1200,
  peak_rating integer not null default 1200,
  rated_games integer not null default 0
);
create table if not exists public.online_games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null,
  black_id uuid,
  white_name text not null,
  black_name text not null,
  white_rating integer not null,
  black_rating integer not null,
  is_bot boolean not null default false,
  minutes integer not null check (minutes in (3,5,10,15)),
  pgn text not null default '',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn text not null default 'w' check (turn in ('w','b')),
  white_ms bigint not null,
  black_ms bigint not null,
  turn_started_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  result text check (result in ('1-0','0-1','1/2-1/2')),
  reason text not null default '',
  version integer not null default 0,
  ply_count integer not null default 0,
  draw_offer uuid,
  rated boolean not null default false,
  white_delta integer not null default 0,
  black_delta integer not null default 0,
  check ((is_bot and black_id is null) or (not is_bot and black_id is not null and white_id <> black_id))
);
create table if not exists public.online_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minutes integer not null check (minutes in (3,5,10,15)),
  queued_at timestamptz not null default clock_timestamp(),
  last_seen timestamptz not null default clock_timestamp()
);
create table if not exists public.online_seats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game_id uuid not null references public.online_games(id)
);
create index if not exists online_games_finished on public.online_games(finished_at desc) where result is not null;
-- Presence belongs to the server, independently of the move version. Existing
-- active games receive a fresh reconnect window when this migration is applied.
alter table public.online_games add column if not exists white_seen_at timestamptz not null default clock_timestamp();
alter table public.online_games add column if not exists black_seen_at timestamptz not null default clock_timestamp();
alter table public.online_games add column if not exists white_disconnected_at timestamptz;
alter table public.online_games add column if not exists black_disconnected_at timestamptz;
-- One server-measured elapsed time per committed ply. Old plies stay unknown.
alter table public.online_games add column if not exists move_times_ms jsonb not null default '[]'::jsonb;
create index if not exists online_games_white on public.online_games(white_id,created_at desc);
create index if not exists online_games_black on public.online_games(black_id,created_at desc);
alter table public.online_players enable row level security;
alter table public.online_games enable row level security;
alter table public.online_queue enable row level security;
alter table public.online_seats enable row level security;
revoke all on public.online_players, public.online_games, public.online_queue, public.online_seats from anon, authenticated;
grant select on public.online_players, public.online_games to authenticated;
grant all on public.online_players, public.online_games, public.online_queue, public.online_seats to service_role;
drop policy if exists "Online ratings are visible" on public.online_players;
create policy "Online ratings are visible" on public.online_players for select to authenticated using (true);
drop policy if exists "Read own live games and completed community games" on public.online_games;
create policy "Read own live games and completed community games" on public.online_games for select to authenticated
  using (auth.uid() = white_id or auth.uid() = black_id or result is not null);

-- FIDE rapid/blitz table 7.1.2; the rating difference is capped at 400.
create or replace function public.online_expected(p_rating integer, p_opponent integer)
returns numeric language sql immutable set search_path = '' as $$
  select case when p_rating >= p_opponent then probability else 1-probability end from (
    select .50 + (ordinality-1)*.01 as probability
    from unnest(array[3,10,17,25,32,39,46,53,61,68,76,83,91,98,106,113,121,129,137,145,153,162,170,179,188,197,206,215,225,235,245,256,267,278,290,302,315,328,344,357,374,391,411]) with ordinality as t(bound,ordinality)
    where least(400,abs(p_rating-p_opponent)) <= bound order by bound limit 1
  ) s;
$$;

create or replace function public.online_join(p_user uuid, p_name text, p_minutes integer, p_cancel boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.online_players; other public.online_players; q public.online_queue; g public.online_games;
  opponent uuid; white_user uuid; black_user uuid; stamp timestamptz := clock_timestamp();
begin
  if p_user is null or p_minutes is null or p_minutes not in (3,5,10,15) then raise exception 'Invalid matchmaking request'; end if;
  -- Serialize pairing, cancellation and fallback, so a user can never occupy two games.
  perform pg_advisory_xact_lock(77412001);
  insert into public.online_players(user_id,display_name) values(p_user,left(coalesce(nullif(trim(p_name),''),'Player'),40))
    on conflict(user_id) do update set display_name=excluded.display_name;
  select * into me from public.online_players where user_id=p_user;
  select games.* into g from public.online_games games join public.online_seats seats on games.id=seats.game_id where seats.user_id=p_user;
  if g.id is not null then return jsonb_build_object('game',to_jsonb(g),'profile',to_jsonb(me)); end if;
  if p_cancel then
    delete from public.online_queue where user_id=p_user;
    return jsonb_build_object('game',null,'queued',false,'profile',to_jsonb(me),'server_now',stamp);
  end if;
  delete from public.online_queue where last_seen < stamp - interval '15 seconds';
  insert into public.online_queue(user_id,minutes) values(p_user,p_minutes) on conflict(user_id) do update
    set last_seen=stamp, minutes=p_minutes, queued_at=case when public.online_queue.minutes=p_minutes then public.online_queue.queued_at else stamp end;
  select * into q from public.online_queue where user_id=p_user;
  select queue.user_id into opponent from public.online_queue queue join public.online_players players on players.user_id=queue.user_id
    where queue.user_id<>p_user and queue.minutes=p_minutes and queue.last_seen>=stamp-interval '15 seconds'
      and not exists(select 1 from public.online_seats seats where seats.user_id=queue.user_id)
    order by abs(players.rating-me.rating),queue.queued_at,queue.user_id limit 1;
  if opponent is null and stamp < q.queued_at+interval '20 seconds' then
    return jsonb_build_object('game',null,'queued',true,'profile',to_jsonb(me),'fallback_at',q.queued_at+interval '20 seconds','server_now',stamp);
  end if;
  if opponent is null then
    insert into public.online_games(white_id,white_name,black_name,white_rating,black_rating,is_bot,minutes,white_ms,black_ms)
      values(p_user,me.display_name,'Arcade practice bot',me.rating,me.rating,true,p_minutes,p_minutes*60000,p_minutes*60000) returning * into g;
  else
    select * into other from public.online_players where user_id=opponent;
    white_user:=case when random()<.5 then p_user else opponent end;
    black_user:=case when white_user=p_user then opponent else p_user end;
    insert into public.online_games(white_id,black_id,white_name,black_name,white_rating,black_rating,minutes,white_ms,black_ms)
      values(white_user,black_user,case when white_user=p_user then me.display_name else other.display_name end,
        case when black_user=p_user then me.display_name else other.display_name end,
        case when white_user=p_user then me.rating else other.rating end,
        case when black_user=p_user then me.rating else other.rating end,p_minutes,p_minutes*60000,p_minutes*60000) returning * into g;
    insert into public.online_seats values(opponent,g.id);
  end if;
  insert into public.online_seats values(p_user,g.id);
  delete from public.online_queue where user_id in(p_user,opponent);
  return jsonb_build_object('game',to_jsonb(g),'profile',to_jsonb(me),'server_now',stamp);
end;
$$;

-- Only called after the Edge Function has replayed and validated the full PGN.
create or replace function public.online_commit(p_game uuid,p_version integer,p_actor uuid,p_kind text,
  p_pgn text default null,p_fen text default null,p_turn text default null,p_result text default null,p_reason text default '',p_timeout_result text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.online_games; w public.online_players; b public.online_players;
  stamp timestamptz := clock_timestamp(); elapsed bigint; remaining bigint; actor_turn uuid;
  score numeric; kw integer; kb integer; wd integer:=0; bd integer:=0;
  white_deadline timestamptz; black_deadline timestamptz; disconnect_deadline timestamptz;
  clock_deadline timestamptz;
begin
  select * into g from public.online_games where id=p_game for update;
  stamp:=clock_timestamp();
  if g.id is null then raise exception 'Game not found'; end if;
  if p_actor is not null and p_actor<>g.white_id and p_actor is distinct from g.black_id then raise exception 'Not a participant'; end if;
  if p_actor is null and (not g.is_bot or g.turn<>'b' or p_kind<>'move') then raise exception 'Invalid bot action'; end if;
  if g.result is not null or g.version<>p_version then return to_jsonb(g); end if;
  elapsed:=greatest(0,floor(extract(epoch from (stamp-g.turn_started_at))*1000)::bigint);
  remaining:=(case when g.turn='w' then g.white_ms else g.black_ms end)-elapsed;
  actor_turn:=case when g.turn='w' then g.white_id else g.black_id end;
  white_deadline:=coalesce(g.white_disconnected_at,g.white_seen_at)+interval '20 seconds';
  black_deadline:=case when g.is_bot then 'infinity'::timestamptz else coalesce(g.black_disconnected_at,g.black_seen_at)+interval '20 seconds' end;
  disconnect_deadline:=least(white_deadline,black_deadline);
  clock_deadline:=g.turn_started_at+(case when g.turn='w' then g.white_ms else g.black_ms end)*interval '1 millisecond';
  -- Check expiry BEFORE accepting a heartbeat: a late return cannot revive play.
  -- Whichever deadline expired first decides the outcome.
  if disconnect_deadline<=stamp and disconnect_deadline<=clock_deadline then
    g.result:=case when white_deadline=black_deadline then '1/2-1/2' when white_deadline<black_deadline then '0-1' else '1-0' end;
    g.reason:=case when white_deadline=black_deadline then 'Both players disconnected' else 'Opponent disconnected (20-second reconnect window expired)' end;
    remaining:=greatest(0,(case when g.turn='w' then g.white_ms else g.black_ms end)-greatest(0,floor(extract(epoch from (disconnect_deadline-g.turn_started_at))*1000)::bigint));
    if g.turn='w' then g.white_ms:=remaining; else g.black_ms:=remaining; end if;
  elsif remaining<=0 then
    if p_timeout_result is null or p_timeout_result not in ('1-0','0-1','1/2-1/2') then raise exception 'Timeout must be adjudicated by server'; end if;
    g.result:=p_timeout_result; g.reason:='Time expired';
    if g.turn='w' then g.white_ms:=0; else g.black_ms:=0; end if;
  elsif p_kind='move' then
    if p_actor is distinct from actor_turn then raise exception 'Wait for your turn'; end if;
    if p_pgn is null or p_fen is null or p_turn is null or p_turn not in ('w','b') or p_turn=g.turn then raise exception 'Invalid move'; end if;
    if jsonb_array_length(g.move_times_ms) <> g.ply_count then
      select coalesce(jsonb_agg(null::bigint), '[]'::jsonb) into g.move_times_ms from generate_series(1,g.ply_count);
    end if;
    g.move_times_ms:=g.move_times_ms || jsonb_build_array(elapsed);
    g.pgn:=p_pgn; g.fen:=p_fen; g.turn:=p_turn; g.ply_count:=g.ply_count+1;
    if p_turn='b' then g.white_ms:=remaining; else g.black_ms:=remaining; end if;
    g.turn_started_at:=stamp; g.result:=p_result; g.reason:=p_reason;
    -- An offer stays open until accepted, declined, or its recipient makes a move.
    if g.draw_offer is distinct from p_actor then g.draw_offer:=null; end if;
  elsif p_kind='resign' then
    g.result:=case when p_actor=g.white_id then '0-1' else '1-0' end; g.reason:='Resignation';
  elsif p_kind='offer_draw' and not g.is_bot then g.draw_offer:=p_actor;
  elsif p_kind='decline_draw' and g.draw_offer is not null and g.draw_offer<>p_actor then g.draw_offer:=null;
  elsif p_kind='accept_draw' and g.draw_offer is not null and g.draw_offer<>p_actor then
    g.result:='1/2-1/2'; g.reason:='Draw by agreement';
  elsif p_kind in ('tick','disconnect','inspect') then null;
  else raise exception 'Invalid action'; end if;
  if g.result is null and p_actor is not null and p_kind<>'inspect' then
    if p_actor=g.white_id then
      if p_kind='disconnect' then g.white_disconnected_at:=coalesce(g.white_disconnected_at,stamp);
      else g.white_seen_at:=stamp; g.white_disconnected_at:=null; end if;
    else
      if p_kind='disconnect' then g.black_disconnected_at:=coalesce(g.black_disconnected_at,stamp);
      else g.black_seen_at:=stamp; g.black_disconnected_at:=null; end if;
    end if;
  end if;
  if g.result is not null then
    if p_kind<>'move' and remaining>0 then
      if g.turn='w' then g.white_ms:=remaining; else g.black_ms:=remaining; end if;
    end if;
    g.finished_at:=stamp; g.draw_offer:=null;
    -- Bot practice and unplayed games cannot alter the human rating pool.
    g.rated:=not g.is_bot and g.ply_count>=2 and not(abs(g.white_rating-g.black_rating)>=600 and greatest(g.white_rating,g.black_rating)>2600);
    if g.rated then
      -- Consistent lock order across games; a participant has only one active seat.
      perform 1 from public.online_players where user_id in(g.white_id,g.black_id) order by user_id for update;
      select * into w from public.online_players where user_id=g.white_id;
      select * into b from public.online_players where user_id=g.black_id;
      kw:=case when w.rated_games<30 then 40 when w.peak_rating>=2400 then 10 else 20 end;
      kb:=case when b.rated_games<30 then 40 when b.peak_rating>=2400 then 10 else 20 end;
      score:=case g.result when '1-0' then 1 when '0-1' then 0 else .5 end;
      wd:=round(kw*(score-public.online_expected(g.white_rating,g.black_rating)));
      bd:=round(kb*(1-score-public.online_expected(g.black_rating,g.white_rating)));
      update public.online_players set rating=rating+wd,peak_rating=greatest(peak_rating,rating+wd),rated_games=rated_games+1 where user_id=g.white_id;
      update public.online_players set rating=rating+bd,peak_rating=greatest(peak_rating,rating+bd),rated_games=rated_games+1 where user_id=g.black_id;
      g.white_delta:=wd; g.black_delta:=bd;
    end if;
    delete from public.online_seats where game_id=g.id;
  end if;
  -- Heartbeats must not invalidate moves or cancel an in-progress drag/premove.
  if p_kind not in ('tick','disconnect','inspect') or g.result is not null then g.version:=g.version+1; end if;
  update public.online_games set pgn=g.pgn,fen=g.fen,turn=g.turn,white_ms=g.white_ms,black_ms=g.black_ms,
    turn_started_at=g.turn_started_at,result=g.result,reason=g.reason,finished_at=g.finished_at,version=g.version,
    ply_count=g.ply_count,move_times_ms=g.move_times_ms,draw_offer=g.draw_offer,rated=g.rated,white_delta=g.white_delta,black_delta=g.black_delta,
    white_seen_at=g.white_seen_at,black_seen_at=g.black_seen_at,white_disconnected_at=g.white_disconnected_at,black_disconnected_at=g.black_disconnected_at where id=g.id;
  return to_jsonb(g);
end;
$$;
revoke all on function public.online_join(uuid,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.online_commit(uuid,integer,uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.online_join(uuid,text,integer,boolean) to service_role;
grant execute on function public.online_commit(uuid,integer,uuid,text,text,text,text,text,text,text) to service_role;
commit;
