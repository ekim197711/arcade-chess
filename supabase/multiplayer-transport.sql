-- Run after multiplayer.sql and roles.sql. Routine reads/presence/search do not
-- need an Edge Function; chess decisions remain in the trusted multiplayer handler.
begin;
create or replace function public.online_state(p_game uuid, p_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); g public.online_games; stamp timestamptz;
  participant boolean; adjudicate boolean := false; bot_due boolean := false;
  hash bigint := 2166136261; input text; i integer;
  answer jsonb;
begin
  perform public.app_require_active();
  select * into g from public.online_games where id=p_game for update;
  stamp := clock_timestamp();
  if g.id is null then raise exception 'Game not found' using errcode='42501'; end if;
  participant := me is not distinct from g.white_id or me is not distinct from g.black_id;
  if not participant and g.result is null then raise exception 'This live game is private' using errcode='42501'; end if;
  if participant and g.result is null then
    -- Check the same expiry conditions BEFORE accepting a returning heartbeat.
    -- Only the Edge Function adjudicates chess-specific timeout outcomes.
    adjudicate := coalesce(g.white_disconnected_at,g.white_seen_at)+interval '20 seconds' <= stamp
      or (not g.is_bot and coalesce(g.black_disconnected_at,g.black_seen_at)+interval '20 seconds' <= stamp)
      or g.turn_started_at+(case when g.turn='w' then g.white_ms else g.black_ms end)*interval '1 millisecond' <= stamp;
    if not adjudicate then
      if me=g.white_id then g.white_seen_at:=stamp; g.white_disconnected_at:=null;
      else g.black_seen_at:=stamp; g.black_disconnected_at:=null; end if;
      update public.online_games set white_seen_at=g.white_seen_at,black_seen_at=g.black_seen_at,
        white_disconnected_at=g.white_disconnected_at,black_disconnected_at=g.black_disconnected_at where id=g.id;
      if g.is_bot and g.turn='b' then
        -- FNV-1a, matching botThinkDelayMs in the trusted chess rules.
        input:=g.id::text||':'||g.ply_count::text;
        for i in 1..length(input) loop hash:=mod((hash # ascii(substr(input,i,1))::bigint)*16777619,4294967296); end loop;
        bot_due:=stamp>=g.turn_started_at+(1000+mod(hash,5)*1000)*interval '1 millisecond';
      end if;
    end if;
  end if;
  answer:=jsonb_build_object('server_now',stamp,'edge_required',adjudicate or bot_due);
  if p_version is distinct from g.version then
    answer:=answer||jsonb_build_object('game',to_jsonb(g));
  else
    answer:=answer||jsonb_build_object('presence',jsonb_build_object('game_id',g.id,'version',g.version,
      'white_seen_at',g.white_seen_at,'black_seen_at',g.black_seen_at,
      'white_disconnected_at',g.white_disconnected_at,'black_disconnected_at',g.black_disconnected_at));
  end if;
  return answer;
end;
$$;

create or replace function public.online_matchmake(p_minutes integer, p_cancel boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare name text;
begin
  perform public.app_require_active();
  if p_cancel is null then raise exception 'Choose a matchmaking action'; end if;
  select left(coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),'Player'),40)
    into name from auth.users where id=auth.uid();
  return public.online_join(auth.uid(),name,p_minutes,p_cancel)||jsonb_build_object('server_now',clock_timestamp());
end;
$$;

create or replace function public.online_disconnect(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid:=auth.uid(); stamp timestamptz;
begin
  perform public.app_require_active();
  perform 1 from public.online_games where id=p_game and result is null and me in (white_id,black_id) for update;
  if not found then return; end if;
  stamp:=clock_timestamp();
  update public.online_games set
    white_disconnected_at=case when white_id=me then coalesce(white_disconnected_at,stamp) else white_disconnected_at end,
    black_disconnected_at=case when black_id=me then coalesce(black_disconnected_at,stamp) else black_disconnected_at end
  where id=p_game and result is null and me in (white_id,black_id);
end;
$$;
revoke all on function public.online_state(uuid,integer),public.online_matchmake(integer,boolean),public.online_disconnect(uuid) from public,anon,authenticated;
grant execute on function public.online_state(uuid,integer),public.online_matchmake(integer,boolean),public.online_disconnect(uuid) to authenticated;
commit;
