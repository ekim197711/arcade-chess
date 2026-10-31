-- Run after multiplayer.sql. Social data is private to its participants.
begin;
create table if not exists public.online_friendships (
  player_a uuid references auth.users(id) on delete cascade,
  player_b uuid references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  accepted boolean not null default false,
  primary key (player_a, player_b),
  check (player_a < player_b and requested_by in (player_a, player_b))
);
create table if not exists public.online_social_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emojis_enabled boolean not null default true
);
create table if not exists public.online_social_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.online_games(id) on delete cascade,
  kind text not null check (kind in ('emoji', 'chat')),
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists online_social_conversation on public.online_social_messages(sender_id, recipient_id, id desc);
create index if not exists online_social_reactions on public.online_social_messages(game_id, id desc) where kind = 'emoji';
create index if not exists online_social_match_chat on public.online_social_messages(game_id, id desc) where kind = 'chat';
alter table public.online_friendships enable row level security;
alter table public.online_social_preferences enable row level security;
alter table public.online_social_messages enable row level security;
revoke all on public.online_friendships, public.online_social_preferences, public.online_social_messages from anon, authenticated;

-- A single authenticated RPC owns authorization, mutual consent and throttling.
create or replace function public.online_social(
  p_action text default 'state', p_game uuid default null, p_peer uuid default null,
  p_body text default null, p_enabled boolean default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); peer uuid := p_peer; a uuid; b uuid;
  g public.online_games; f public.online_friendships;
  enabled boolean; items jsonb; messages jsonb := '[]'; reactions jsonb := '[]';
begin
  if to_regprocedure('public.app_require_active(uuid)') is not null then
    perform public.app_require_active(); -- account-access-guard
  end if;
  if me is null then raise exception 'Sign in to use friends and chat'; end if;
  if p_action is null or p_action not in ('state','request','accept','remove','emoji','chat','preferences') then
    raise exception 'Invalid social action';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text, 92714));
  if p_game is not null then
    select * into g from public.online_games where id = p_game;
    if g.id is null or g.is_bot or (me is distinct from g.white_id and me is distinct from g.black_id) then
      raise exception 'Social features are available to human match participants only';
    end if;
    peer := case when me = g.white_id then g.black_id else g.white_id end;
  end if;
  if peer = me then raise exception 'Choose another player'; end if;
  if peer is not null then
    a := least(me, peer); b := greatest(me, peer);
    -- Serialize both directions, including accepting/removing while sending.
    perform pg_advisory_xact_lock(hashtextextended(a::text || b::text, 92715));
    select * into f from public.online_friendships where player_a = a and player_b = b;
  end if;
  if p_action = 'preferences' then
    if p_enabled is null then raise exception 'Choose an emoji preference'; end if;
    insert into public.online_social_preferences values(me, p_enabled)
      on conflict(user_id) do update set emojis_enabled = excluded.emojis_enabled;
  elsif p_action = 'request' then
    if g.id is null then raise exception 'Add friends from a shared human match'; end if;
    insert into public.online_friendships values(a, b, me, false) on conflict do nothing;
  elsif p_action = 'accept' then
    if f.requested_by is null or f.requested_by = me then raise exception 'No incoming friend request'; end if;
    update public.online_friendships set accepted = true where player_a = a and player_b = b;
  elsif p_action = 'remove' then
    delete from public.online_friendships where player_a = a and player_b = b;
    -- Removing a friend also clears the conversation for both players.
    delete from public.online_social_messages where kind = 'chat' and game_id is null
      and ((sender_id = me and recipient_id = peer) or (sender_id = peer and recipient_id = me));
  elsif p_action in ('emoji', 'chat') then
    if peer is null then raise exception 'Choose a player'; end if;
    if p_action = 'chat' and g.id is null and not coalesce(f.accepted, false) then raise exception 'Lobby chat is available after both players become friends'; end if;
    if p_body is null or char_length(trim(p_body)) not between 1 and 500 then raise exception 'Messages must contain 1 to 500 characters'; end if;
    if p_action = 'emoji' then
      if g.id is null then raise exception 'Reactions require a shared human match'; end if;
      if p_body not in ('👍','😮','😠','😂','👏','🤝','😊','😎','🤔','😅','😭','😱','🙄','😴','🔥','🎉','💯','❤️','💔','🤯','😬','🤨','😉','🥳','🤓','😈','😇','😤','🥲','😢','🤩','😳','😵','🙃','🫡','🤫','🙏','💪','✌️','🤞','👀','🧠','⚡','🏆','🎯','♟️','👑','💥') then raise exception 'Choose an available emoji'; end if;
      if exists(select 1 from public.online_social_preferences where user_id in (me, peer) and not emojis_enabled) then
        raise exception 'Emoji reactions are turned off';
      end if;
    end if;
    if exists(select 1 from public.online_social_messages where sender_id = me and kind = p_action
      and created_at > clock_timestamp() - case when p_action = 'emoji' then interval '2 seconds' else interval '1 second' end) then
      raise exception 'Please wait a moment before sending again';
    end if;
    insert into public.online_social_messages(sender_id, recipient_id, game_id, kind, body)
      values(me, peer, p_game, p_action, trim(p_body));
  end if;
  select coalesce((select emojis_enabled from public.online_social_preferences where user_id = me), true) into enabled;
  select coalesce(jsonb_agg(row_to_json(t)), '[]') into items from (
    select case when player_a = me then player_b else player_a end as user_id,
      coalesce(p.display_name, 'Player') as name, accepted, requested_by
    from public.online_friendships s left join public.online_players p
      on p.user_id = case when player_a = me then player_b else player_a end
    where me in (player_a, player_b)
    order by accepted, p.display_name, s.player_a, s.player_b
  ) t;
  if peer is not null then
    select * into f from public.online_friendships where player_a = a and player_b = b;
    if f.accepted or g.id is not null then
      select coalesce(jsonb_agg(row_to_json(t) order by t.id), '[]') into messages from (
        select id, sender_id, body, created_at from public.online_social_messages
        where kind = 'chat' and ((sender_id = me and recipient_id = peer) or (sender_id = peer and recipient_id = me))
          and (game_id = p_game or (game_id is null and p_game is null))
        order by id desc limit 50
      ) t;
    end if;
    if enabled and g.id is not null then
      select coalesce(jsonb_agg(row_to_json(t) order by t.id), '[]') into reactions from (
        select id, sender_id, body, created_at from public.online_social_messages
        where kind = 'emoji' and game_id = p_game and created_at > clock_timestamp() - interval '8 seconds'
        order by id desc limit 4
      ) t;
    end if;
  end if;
  return jsonb_build_object('friends', items, 'messages', messages, 'reactions', reactions,
    'emojis_enabled', enabled, 'peer_emojis_enabled', coalesce((select emojis_enabled from public.online_social_preferences where user_id = peer), true));
end;
$$;
revoke all on function public.online_social(text, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.online_social(text, uuid, uuid, text, boolean) to authenticated;
commit;
