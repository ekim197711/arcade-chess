-- Apply after multiplayer.sql, roles.sql and multiplayer-transport.sql.
-- Preserves existing Standard clients; variant pairing and setup stay server-owned.
begin;
alter table public.online_games add column if not exists mode text not null default 'standard' check (mode in ('standard','freestyle'));
alter table public.online_queue add column if not exists mode text not null default 'standard' check (mode in ('standard','freestyle'));
create index if not exists online_queue_variant_clock on public.online_queue(mode,minutes);

-- Same Scharnagl numbering as src/chess.ts. Clients cannot select their setup.
create or replace function public.online_freestyle_fen(p_index integer)
returns text language plpgsql immutable set search_path = '' as $$
declare
  rank text[] := array['','','','','','','','']; n integer := p_index;
  slots integer[]; pair_a integer[] := array[1,1,1,1,2,2,2,3,3,4];
  pair_b integer[] := array[2,3,4,5,3,4,5,4,5,5];
  back text; rights text;
begin
  if n is null or n<0 or n>=960 then raise exception 'Invalid Chess960 position'; end if;
  rank[(n%4)*2+2]:='B'; n:=n/4;
  rank[(n%4)*2+1]:='B'; n:=n/4;
  select array_agg(i order by i) into slots from generate_series(1,8) i where rank[i]='';
  rank[slots[n%6+1]]:='Q'; n:=n/6;
  select array_agg(i order by i) into slots from generate_series(1,8) i where rank[i]='';
  rank[slots[pair_a[n+1]]]:='N'; rank[slots[pair_b[n+1]]]:='N';
  select array_agg(i order by i) into slots from generate_series(1,8) i where rank[i]='';
  rank[slots[1]]:='R'; rank[slots[2]]:='K'; rank[slots[3]]:='R';
  back:=array_to_string(rank,''); rights:=chr(64+slots[3])||chr(64+slots[1]);
  return lower(back)||'/pppppppp/8/8/8/8/PPPPPPPP/'||back||' w '||rights||lower(rights)||' - 0 1';
end;
$$;

create or replace function public.online_join_variant(p_user uuid, p_name text, p_minutes integer, p_cancel boolean, p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me public.online_players; other public.online_players; q public.online_queue; g public.online_games;
  opponent uuid; white_user uuid; black_user uuid; stamp timestamptz := clock_timestamp();
  initial_fen text; initial_pgn text := '';
begin
  perform public.app_require_active(p_user);
  if p_mode is null or p_mode not in ('standard','freestyle') or p_cancel is null then raise exception 'Invalid play style'; end if;
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
  insert into public.online_queue(user_id,minutes,mode) values(p_user,p_minutes,p_mode) on conflict(user_id) do update
    set last_seen=stamp, minutes=p_minutes, mode=p_mode, queued_at=case when public.online_queue.minutes=p_minutes and public.online_queue.mode=p_mode then public.online_queue.queued_at else stamp end;
  select * into q from public.online_queue where user_id=p_user;
  select queue.user_id into opponent from public.online_queue queue join public.online_players players on players.user_id=queue.user_id
    where queue.user_id<>p_user and queue.minutes=p_minutes and queue.mode=p_mode and queue.last_seen>=stamp-interval '15 seconds'
      and not exists(select 1 from public.online_seats seats where seats.user_id=queue.user_id)
    order by abs(players.rating-me.rating),queue.queued_at,queue.user_id limit 1;
  if opponent is null and stamp < q.queued_at+interval '20 seconds' then
    return jsonb_build_object('game',null,'queued',true,'profile',to_jsonb(me),'fallback_at',q.queued_at+interval '20 seconds','server_now',stamp);
  end if;
  initial_fen := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  if p_mode='freestyle' then
    initial_fen := public.online_freestyle_fen(floor(random()*960)::integer);
    initial_pgn := '[Variant "Chess960"]' || chr(10) || '[SetUp "1"]' || chr(10) || '[FEN "' || initial_fen || '"]' || chr(10) || chr(10) || '*';
    initial_fen := initial_fen || ' chess960';
  end if;
  if opponent is null then
    insert into public.online_games(white_id,white_name,black_name,white_rating,black_rating,is_bot,minutes,white_ms,black_ms,mode,fen,pgn)
      values(p_user,me.display_name,'Arcade practice bot',me.rating,me.rating,true,p_minutes,p_minutes*60000,p_minutes*60000,p_mode,initial_fen,initial_pgn) returning * into g;
  else
    select * into other from public.online_players where user_id=opponent;
    white_user:=case when random()<.5 then p_user else opponent end;
    black_user:=case when white_user=p_user then opponent else p_user end;
    insert into public.online_games(white_id,black_id,white_name,black_name,white_rating,black_rating,minutes,white_ms,black_ms,mode,fen,pgn)
      values(white_user,black_user,case when white_user=p_user then me.display_name else other.display_name end,
        case when black_user=p_user then me.display_name else other.display_name end,
        case when white_user=p_user then me.rating else other.rating end,
        case when black_user=p_user then me.rating else other.rating end,p_minutes,p_minutes*60000,p_minutes*60000,p_mode,initial_fen,initial_pgn) returning * into g;
    insert into public.online_seats values(opponent,g.id);
  end if;
  insert into public.online_seats values(p_user,g.id);
  delete from public.online_queue where user_id in(p_user,opponent);
  return jsonb_build_object('game',to_jsonb(g),'profile',to_jsonb(me),'server_now',stamp);
end;
$$;

-- The legacy endpoint must also filter Standard queues, never pair across variants.
create or replace function public.online_join(p_user uuid, p_name text, p_minutes integer, p_cancel boolean default false)
returns jsonb language sql security definer set search_path = '' as $$
  select public.online_join_variant(p_user,p_name,p_minutes,p_cancel,'standard');
$$;

-- Exact three-argument overload; legacy two-argument calls keep working.
create or replace function public.online_matchmake(p_minutes integer, p_cancel boolean, p_mode text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare name text;
begin
  perform public.app_require_active();
  select left(coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),'Player'),40)
    into name from auth.users where id=auth.uid();
  return public.online_join_variant(auth.uid(),name,p_minutes,p_cancel,p_mode)||jsonb_build_object('server_now',clock_timestamp());
end;
$$;
revoke all on function public.online_join_variant(uuid,text,integer,boolean,text),public.online_freestyle_fen(integer) from public,anon,authenticated;
grant execute on function public.online_join_variant(uuid,text,integer,boolean,text),public.online_freestyle_fen(integer) to service_role;
revoke all on function public.online_matchmake(integer,boolean,text) from public,anon,authenticated;
grant execute on function public.online_matchmake(integer,boolean,text) to authenticated;
commit;
