-- Run after administration.sql and social.sql. Repeat after replacing game RPCs.
begin;
create table if not exists public.app_account_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kind text not null check (kind in ('banned','suspended')),
  reason text not null check (length(trim(reason)) between 1 and 500),
  until_at timestamptz,
  check ((kind = 'banned' and until_at is null) or (kind = 'suspended' and until_at is not null))
);
create table if not exists public.app_administration_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text,
  until_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.app_account_restrictions enable row level security;
alter table public.app_administration_audit enable row level security;
revoke all on public.app_account_restrictions, public.app_administration_audit from public, anon, authenticated;

create or replace function public.app_user_active(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = p_user_id and not coalesce(is_anonymous, false)
    and (banned_until is null or banned_until <= now()));
$$;
create or replace function public.app_access_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_user_active(auth.uid());
$$;
create or replace function public.app_require_active(p_user_id uuid default auth.uid())
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_user_active(p_user_id) then
    raise exception 'Account access is restricted or authentication is required' using errcode = '42501';
  end if;
end;
$$;
create or replace function public.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select case when u.email_confirmed_at is not null and exists(
    select 1 from public.app_administrators a where a.user_id = u.id
  ) then 'administrator' else 'user' end
  from auth.users u where u.id = auth.uid() and not coalesce(u.is_anonymous, false);
$$;
create or replace function public.app_account_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare stamp timestamptz; restriction public.app_account_restrictions;
begin
  select banned_until into stamp from auth.users where id = auth.uid() and not coalesce(is_anonymous,false);
  if not found then raise exception 'Authentication required'; end if;
  if stamp is null or stamp <= now() then return jsonb_build_object('status','active'); end if;
  select * into restriction from public.app_account_restrictions where user_id = auth.uid();
  return jsonb_build_object('status', case when restriction.kind = 'banned' then 'banned' else 'suspended' end,
    'until', case when restriction.kind = 'banned' then null else stamp end, 'reason', coalesce(restriction.reason, 'Account access restricted'));
end;
$$;
create or replace function public.app_heartbeat()
returns text language plpgsql security definer set search_path = '' as $$
declare account jsonb := public.app_account_status();
begin
  if account ->> 'status' <> 'active' then return account ->> 'status'; end if;
  insert into public.app_presence(user_id) values(auth.uid()) on conflict(user_id) do update set last_seen=now();
  return public.app_role();
end;
$$;

create or replace function public.admin_users(p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.app_require_active();
  if public.app_role() is distinct from 'administrator' then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_offset is null or p_offset < 0 or p_search is null or length(p_search)>200 then raise exception 'Invalid search'; end if;
  return (select coalesce(jsonb_agg(row_to_json(t)), '[]') from (
    select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '') as name,
      case when a.user_id is not null and u.email_confirmed_at is not null then 'administrator' else 'user' end as role,
      u.email_confirmed_at is not null as verified,
      case when u.banned_until > now() and r.kind = 'banned' then 'banned'
        when u.banned_until > now() then 'suspended' else 'active' end as status,
      case when u.banned_until > now() and coalesce(r.kind,'') <> 'banned' then u.banned_until else null end as until,
      case when u.banned_until > now() then r.reason else null end as reason
    from auth.users u left join public.app_administrators a on a.user_id=u.id
      left join public.app_account_restrictions r on r.user_id=u.id
    where not coalesce(u.is_anonymous,false) and (position(lower(p_search) in lower(coalesce(u.email,'')))>0
      or position(lower(p_search) in lower(coalesce(u.raw_user_meta_data ->> 'full_name',u.raw_user_meta_data ->> 'name','')))>0)
    order by u.created_at desc,u.id limit 50 offset p_offset
  ) t);
end;
$$;
create or replace function public.admin_set_administrator(p_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare verified timestamptz;
begin
  perform pg_advisory_xact_lock(77412001);
  perform public.app_require_active();
  if public.app_role() is distinct from 'administrator' then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Ask another administrator to change your role'; end if;
  if p_enabled is null then raise exception 'Role selection required'; end if;
  select email_confirmed_at into verified from auth.users where id=p_user_id and not coalesce(is_anonymous,false) for update;
  if not found then raise exception 'User not found'; end if;
  if p_enabled then
    if verified is null then raise exception 'User must verify their email first'; end if;
    perform public.app_require_active(p_user_id);
    insert into public.app_administrators(user_id,granted_by) values(p_user_id,auth.uid()) on conflict do nothing;
  else
    delete from public.app_administrators where user_id=p_user_id;
  end if;
  insert into public.app_administration_audit(actor_id,target_id,action)
    values(auth.uid(),p_user_id,case when p_enabled then 'grant_administrator' else 'remove_administrator' end);
end;
$$;
create or replace function public.admin_moderate_user(p_user_id uuid, p_action text, p_reason text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(77412001);
  perform public.app_require_active();
  if public.app_role() is distinct from 'administrator' then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot restrict your own account'; end if;
  if p_action is null or p_action not in ('ban','suspend','restore') or p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Choose an action and enter a reason (1 to 500 characters)'; end if;
  if p_action='suspend' and (p_until is null or p_until <= now() or p_until > now()+interval '365 days') then raise exception 'Suspension must end within the next 365 days'; end if;
  if p_action <> 'suspend' and p_until is not null then raise exception 'Only suspensions have an end date'; end if;
  perform 1 from auth.users where id=p_user_id and not coalesce(is_anonymous,false) for update;
  if not found then raise exception 'User not found'; end if;
  if p_action='restore' then
    update auth.users set banned_until=null where id=p_user_id;
    delete from public.app_account_restrictions where user_id=p_user_id;
  else
    update auth.users set banned_until=case when p_action='ban' then '9999-12-31 00:00:00+00'::timestamptz else p_until end where id=p_user_id;
    insert into public.app_account_restrictions(user_id,kind,reason,until_at)
      values(p_user_id,case when p_action='ban' then 'banned' else 'suspended' end,trim(p_reason),p_until)
      on conflict(user_id) do update set kind=excluded.kind,reason=excluded.reason,until_at=excluded.until_at;
    delete from public.app_presence where user_id=p_user_id;
    delete from public.online_queue where user_id=p_user_id;
    update public.online_games set result=case when white_id=p_user_id then '0-1' else '1-0' end,
      reason=case when p_action='ban' then 'Opponent banned' else 'Opponent suspended' end,
      finished_at=clock_timestamp(), rated=false, white_delta=0, black_delta=0, draw_offer=null, version=version+1
      where result is null and (white_id=p_user_id or black_id=p_user_id);
    delete from public.online_seats where game_id in (select id from public.online_games where white_id=p_user_id or black_id=p_user_id);
  end if;
  insert into public.app_administration_audit(actor_id,target_id,action,reason,until_at)
    values(auth.uid(),p_user_id,p_action,trim(p_reason),p_until);
end;
$$;

-- Existing JWTs remain restricted: RLS covers table access; guards cover RPCs.
do $$
declare relation text; fn record; definition text; guard text;
begin
  foreach relation in array array['player_progress','player_games','online_players','online_games'] loop
    execute format('drop policy if exists "Active account required" on public.%I',relation);
    execute format('create policy "Active account required" on public.%I as restrictive for all to authenticated using (public.app_access_allowed()) with check (public.app_access_allowed())',relation);
  end loop;
  for fn in select p.oid,p.proname,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('record_game_result','merge_guest_progress','save_player_game','online_social','online_join','online_commit','admin_statistics')
  loop
    if position('-- account-access-guard' in fn.prosrc)>0 then continue; end if;
    guard := case fn.proname when 'online_join' then 'perform public.app_require_active(p_user);'
      when 'online_commit' then 'if p_actor is not null then perform public.app_require_active(p_actor); end if;'
      else 'perform public.app_require_active();' end;
    definition := pg_get_functiondef(fn.oid);
    execute replace(definition,fn.prosrc,regexp_replace(fn.prosrc,'\mbegin\M',E'begin\n  '||guard||E' -- account-access-guard\n','i'));
  end loop;
end;
$$;
revoke all on function public.app_user_active(uuid), public.app_access_allowed(), public.app_require_active(uuid),
  public.app_account_status(), public.admin_moderate_user(uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.app_access_allowed(), public.app_require_active(uuid), public.app_account_status(),
  public.admin_moderate_user(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.app_user_active(uuid), public.app_require_active(uuid) to service_role;
commit;
