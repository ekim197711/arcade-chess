-- Run after schema.sql and multiplayer.sql. Repeatable, atomic self-service deletion.
begin;
-- Existing installations must reject outsiders even when a deleted player's ID
-- becomes NULL. Preserve the role guards already installed on this function.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.online_commit(uuid,integer,uuid,text,text,text,text,text,text,text)'::regprocedure) into definition;
  execute replace(definition, 'p_actor<>g.white_id', 'p_actor is distinct from g.white_id');
end;
$$;
alter table public.online_games alter column white_id drop not null;
alter table public.online_games drop constraint if exists online_games_check;
alter table public.online_games add constraint online_games_check check (
  (not is_bot or black_id is null)
  and (white_id is null or black_id is null or white_id <> black_id)
  and (white_id is not null or white_name = 'Deleted user')
  and (is_bot or black_id is not null or black_name = 'Deleted user')
);

-- Also covers account removal through the Auth dashboard/Admin API.
create or replace function public.erase_deleted_player()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize against matchmaking; lock matches before changing their snapshots.
  perform pg_advisory_xact_lock(77412001);
  perform 1 from public.online_games where white_id = old.id or black_id = old.id order by id for update;

  -- A departing player forfeits live human games. These games are unrated.
  update public.online_games set
    result = case when white_id = old.id then '0-1' else '1-0' end,
    reason = 'Account deleted', finished_at = clock_timestamp(),
    draw_offer = null, rated = false, version = version + 1
  where (white_id = old.id or black_id = old.id) and result is null;
  delete from public.online_seats where game_id in (
    select id from public.online_games where white_id = old.id or black_id = old.id
  );

  -- Practice games and matches whose last human is leaving have no other owner.
  delete from public.online_games where
    (white_id = old.id and (is_bot or black_id is null))
    or (black_id = old.id and white_id is null);

  -- Keep the other player's chess record, without the deleted identity (including PGN headers).
  update public.online_games set
    pgn = regexp_replace(pgn, case when white_id = old.id then '\[White "[^"\r\n]*"\]' else '\[Black "[^"\r\n]*"\]' end,
      case when white_id = old.id then '[White "Deleted user"]' else '[Black "Deleted user"]' end, 'g'),
    white_name = case when white_id = old.id then 'Deleted user' else white_name end,
    black_name = case when black_id = old.id then 'Deleted user' else black_name end,
    white_id = case when white_id = old.id then null else white_id end,
    black_id = case when black_id = old.id then null else black_id end,
    draw_offer = case when draw_offer = old.id then null else draw_offer end
  where white_id = old.id or black_id = old.id;
  -- Progress, progress events, private archives, rating, queue, seats and Auth's
  -- identities/sessions are removed by their auth.users ON DELETE CASCADE keys.
  return old;
end;
$$;
revoke all on function public.erase_deleted_player() from public, anon, authenticated;
drop trigger if exists erase_deleted_player on auth.users;
create trigger erase_deleted_player before delete on auth.users
  for each row execute function public.erase_deleted_player();

-- No caller-supplied ID and no service key in the browser. Failure rolls everything back.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = v_user_id;
  if not found then raise exception 'Account no longer exists'; end if;
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
commit;
