-- ============================================================================
-- Kartaa — schéma de référence
--
-- Ce fichier reproduit l'état de la base du projet Supabase « Kartaa ».
-- Il est rejouable tel quel sur un projet vierge.
--
-- Principes :
--   1. Les règles d'accès vivent ici, pas dans le client : un navigateur modifié
--      ne peut pas les contourner.
--   2. Les coordonnées d'un utilisateur ne sont lisibles qu'une carte à la fois,
--      par son adresse — impossible d'aspirer l'annuaire.
--   3. Le serveur ne voit jamais le mot de passe d'un coffre ni sa clé en clair :
--      il ne détient que la clé chiffrée et une empreinte de vérification, et
--      c'est lui qui compte les tentatives.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- utilitaires
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------------- profils
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  email       text not null default '',
  phone       text not null default '',
  plan        text not null default 'free' check (plan in ('free', 'premium', 'vip')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Informations de compte. Le mot de passe est géré par Supabase Auth, jamais ici.';

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "profil visible par son propriétaire" on public.profiles
  for select using ((select auth.uid()) = id);

create policy "profil modifiable par son propriétaire" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------- limites par offre
create or replace function public.plan_limits(p_plan text)
returns table (max_cards integer, max_vaults integer, max_storage_bytes bigint)
language sql immutable set search_path = '' as $$
  select
    case p_plan when 'premium' then 5 when 'vip' then 2147483647 else 1 end,
    case p_plan when 'premium' then 5 when 'vip' then 2147483647 else 1 end,
    case p_plan when 'premium' then 5368709120::bigint
                when 'vip'     then 21474836480::bigint
                else 209715200::bigint end;
$$;

create or replace function public.current_plan()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select plan from public.profiles where id = auth.uid()), 'free');
$$;

-- -------------------------------------------------------------------- cartes
create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  slug          text not null,
  template      text not null default 'standard' check (template in ('standard', 'premium', 'vip')),
  theme         jsonb not null default '{}'::jsonb,
  profile       jsonb not null default '{}'::jsonb,
  socials       jsonb not null default '[]'::jsonb,
  about         text  not null default '',
  activities    jsonb not null default '[]'::jsonb,
  companies     jsonb not null default '[]'::jsonb,
  services      jsonb not null default '[]'::jsonb,
  gallery       jsonb not null default '[]'::jsonb,
  custom_domain jsonb,
  scans         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint cards_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$')
);

create unique index cards_slug_unique on public.cards (lower(slug));
create index cards_user_id_idx on public.cards (user_id);

create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

alter table public.cards enable row level security;

-- Aucune politique publique : le mini-site passe par card_by_slug().
create policy "cartes visibles par leur propriétaire" on public.cards
  for select using ((select auth.uid()) = user_id);
create policy "cartes créées par leur propriétaire" on public.cards
  for insert with check ((select auth.uid()) = user_id);
create policy "cartes modifiables par leur propriétaire" on public.cards
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cartes supprimables par leur propriétaire" on public.cards
  for delete using ((select auth.uid()) = user_id);

create table public.card_scans (
  id         bigint generated always as identity primary key,
  card_id    uuid not null references public.cards (id) on delete cascade,
  source     text not null default 'qr',
  scanned_at timestamptz not null default now()
);

create index card_scans_card_id_idx on public.card_scans (card_id, scanned_at desc);

alter table public.card_scans enable row level security;

create policy "scans visibles par le propriétaire de la carte" on public.card_scans
  for select using (exists (
    select 1 from public.cards c
    where c.id = card_scans.card_id and c.user_id = (select auth.uid())
  ));

create or replace function public.enforce_card_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_max integer; v_count integer;
begin
  select max_cards into v_max from public.plan_limits(public.current_plan());
  select count(*) into v_count from public.cards where user_id = new.user_id;
  if v_count >= v_max then
    raise exception 'Limite de % carte(s) atteinte pour votre offre.', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger cards_limit before insert on public.cards
  for each row execute function public.enforce_card_limit();

-- Lecture publique du mini-site : une carte à la fois, sans l'identifiant du compte.
create or replace function public.card_by_slug(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'template', c.template, 'theme', c.theme,
    'profile', c.profile, 'socials', c.socials, 'about', c.about,
    'activities', c.activities, 'companies', c.companies, 'services', c.services,
    'gallery', c.gallery, 'scans', c.scans, 'createdAt', c.created_at,
    'ownerPlan', p.plan)
  from public.cards c
  join public.profiles p on p.id = c.user_id
  where lower(c.slug) = lower(p_slug);
$$;

create or replace function public.register_card_scan(p_slug text, p_source text default 'qr')
returns void language plpgsql security definer set search_path = '' as $$
declare v_card_id uuid;
begin
  select id into v_card_id from public.cards where lower(slug) = lower(p_slug);
  if v_card_id is null then return; end if;
  update public.cards set scans = scans + 1 where id = v_card_id;
  insert into public.card_scans (card_id, source)
  values (v_card_id, coalesce(nullif(p_source, ''), 'qr'));
end;
$$;

create or replace function public.slug_available(p_slug text, p_except uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.cards
    where lower(slug) = lower(p_slug) and (p_except is null or id <> p_except)
  );
$$;

-- ------------------------------------------------------------------- coffres
create table public.vaults (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null check (length(trim(name)) between 1 and 120),
  protection         text not null default 'password'
                       check (protection in ('password', 'password+biometric')),
  folders            jsonb not null default '[]'::jsonb,
  failed_attempts    integer not null default 0,
  locked_until       timestamptz,
  last_opened_at     timestamptz,
  recovery_issued_at timestamptz not null default now(),
  recovery_used_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index vaults_user_id_idx on public.vaults (user_id);

create trigger vaults_touch before update on public.vaults
  for each row execute function public.touch_updated_at();

alter table public.vaults enable row level security;

create policy "coffres visibles par leur propriétaire" on public.vaults
  for select using ((select auth.uid()) = user_id);
create policy "coffres renommés par leur propriétaire" on public.vaults
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "coffres supprimables par leur propriétaire" on public.vaults
  for delete using ((select auth.uid()) = user_id);
-- Pas de politique INSERT : un coffre ne se crée que par vault_create().

-- RLS active SANS aucune politique : personne, pas même le propriétaire, ne lit
-- cette table directement. Seules les fonctions SECURITY DEFINER y accèdent, ce
-- qui permet d'imposer le comptage des tentatives côté serveur.
create table public.vault_secrets (
  vault_id           uuid primary key references public.vaults (id) on delete cascade,
  kdf_iterations     integer not null default 210000,
  password_salt      text not null,
  password_verifier  bytea not null,
  password_wrap      jsonb not null,
  recovery_salt      text not null,
  recovery_verifier  bytea not null,
  recovery_wrap      jsonb not null,
  biometric          jsonb,
  biometric_wrap     jsonb
);

alter table public.vault_secrets enable row level security;

comment on table public.vault_secrets is
  'Clés de coffre chiffrées et empreintes de vérification. Jamais lisible directement : tout passe par les fonctions vault_*.';

create table public.vault_files (
  id           uuid primary key default gen_random_uuid(),
  vault_id     uuid not null references public.vaults (id) on delete cascade,
  name         text not null,
  mime         text not null default 'application/octet-stream',
  category     text not null default 'document',
  size         bigint not null default 0 check (size >= 0),
  folder_id    text,
  storage_path text not null,
  iv           text not null,
  added_at     timestamptz not null default now()
);

create index vault_files_vault_id_idx on public.vault_files (vault_id, added_at desc);

alter table public.vault_files enable row level security;

create policy "fichiers visibles par le propriétaire du coffre" on public.vault_files
  for select using (exists (select 1 from public.vaults v
    where v.id = vault_files.vault_id and v.user_id = (select auth.uid())));
create policy "fichiers ajoutés par le propriétaire du coffre" on public.vault_files
  for insert with check (exists (select 1 from public.vaults v
    where v.id = vault_files.vault_id and v.user_id = (select auth.uid())));
create policy "fichiers supprimables par le propriétaire du coffre" on public.vault_files
  for delete using (exists (select 1 from public.vaults v
    where v.id = vault_files.vault_id and v.user_id = (select auth.uid())));

create table public.vault_access_log (
  id         bigint generated always as identity primary key,
  vault_id   uuid not null references public.vaults (id) on delete cascade,
  action     text not null,
  result     text not null default 'ok',
  method     text,
  detail     text,
  created_at timestamptz not null default now()
);

create index vault_access_log_vault_id_idx on public.vault_access_log (vault_id, created_at desc);

alter table public.vault_access_log enable row level security;

create policy "journal visible par le propriétaire du coffre" on public.vault_access_log
  for select using (exists (select 1 from public.vaults v
    where v.id = vault_access_log.vault_id and v.user_id = (select auth.uid())));

create or replace function public.enforce_vault_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_max integer; v_count integer;
begin
  select max_vaults into v_max from public.plan_limits(public.current_plan());
  select count(*) into v_count from public.vaults where user_id = new.user_id;
  if v_count >= v_max then
    raise exception 'Limite de % coffre(s) atteinte pour votre offre.', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger vaults_limit before insert on public.vaults
  for each row execute function public.enforce_vault_limit();

create or replace function public.enforce_storage_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_quota bigint; v_used bigint;
begin
  select user_id into v_owner from public.vaults where id = new.vault_id;
  select max_storage_bytes into v_quota
  from public.plan_limits(coalesce((select plan from public.profiles where id = v_owner), 'free'));
  select coalesce(sum(f.size), 0) into v_used
  from public.vault_files f join public.vaults v on v.id = f.vault_id
  where v.user_id = v_owner;
  if v_used + new.size > v_quota then
    raise exception 'Espace de stockage insuffisant pour votre offre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger vault_files_quota before insert on public.vault_files
  for each row execute function public.enforce_storage_quota();

-- ------------------------------------------------------- garde-fous internes
create or replace function public.assert_vault_owner(p_vault_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.vaults where id = p_vault_id and user_id = auth.uid()) then
    raise exception 'Coffre introuvable.' using errcode = 'no_data_found';
  end if;
end;
$$;

create or replace function public.vault_log(
  p_vault_id uuid, p_action text, p_result text default 'ok',
  p_method text default null, p_detail text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_vault_owner(p_vault_id);
  insert into public.vault_access_log (vault_id, action, result, method, detail)
  values (p_vault_id, p_action, p_result, p_method, left(p_detail, 200));
end;
$$;

create or replace function public.vault_register_failure(p_vault_id uuid, p_method text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_attempts integer; v_delay integer;
begin
  update public.vaults set failed_attempts = failed_attempts + 1
  where id = p_vault_id returning failed_attempts into v_attempts;

  v_delay := case when v_attempts <= 2 then 0 when v_attempts = 3 then 30
                  when v_attempts = 4 then 60 when v_attempts = 5 then 300 else 900 end;

  if v_delay > 0 then
    update public.vaults set locked_until = now() + make_interval(secs => v_delay)
    where id = p_vault_id;
  end if;

  insert into public.vault_access_log (vault_id, action, result, method, detail)
  values (p_vault_id, 'vault.unlock', 'failed', p_method, v_attempts::text);

  return v_attempts;
end;
$$;

create or replace function public.vault_locked_for(p_vault_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((
    select greatest(0, ceil(extract(epoch from (locked_until - now())))::integer)
    from public.vaults
    where id = p_vault_id and locked_until is not null and locked_until > now()
  ), 0);
$$;

-- --------------------------------------------------------- API des coffres
create or replace function public.vault_create(
  p_name text, p_kdf_iterations integer,
  p_password_salt text, p_password_verifier text, p_password_wrap jsonb,
  p_recovery_salt text, p_recovery_verifier text, p_recovery_wrap jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.vaults (user_id, name) values (auth.uid(), trim(p_name)) returning id into v_id;

  insert into public.vault_secrets (
    vault_id, kdf_iterations,
    password_salt, password_verifier, password_wrap,
    recovery_salt, recovery_verifier, recovery_wrap)
  values (
    v_id, p_kdf_iterations,
    p_password_salt, extensions.digest(p_password_verifier, 'sha256'), p_password_wrap,
    p_recovery_salt, extensions.digest(p_recovery_verifier, 'sha256'), p_recovery_wrap);

  insert into public.vault_access_log (vault_id, action, result) values (v_id, 'vault.created', 'ok');
  return v_id;
end;
$$;

-- Ce que l'on peut lire AVANT authentification : les sels (publics par nature)
-- et l'état du coffre. Jamais la clé chiffrée.
create or replace function public.vault_intro(p_vault_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform public.assert_vault_owner(p_vault_id);
  select jsonb_build_object(
    'id', v0.id, 'name', v0.name, 'protection', v0.protection,
    'hasBiometric', (s.biometric is not null), 'biometric', s.biometric,
    'failedAttempts', v0.failed_attempts, 'lockedUntil', v0.locked_until,
    'kdfIterations', s.kdf_iterations,
    'passwordSalt', s.password_salt, 'recoverySalt', s.recovery_salt)
  into v
  from public.vaults v0 join public.vault_secrets s on s.vault_id = v0.id
  where v0.id = p_vault_id;
  return v;
end;
$$;

-- Ces fonctions renvoient un STATUT et ne lèvent pas d'exception sur échec :
-- une exception annulerait la transaction, donc aussi l'incrément du compteur
-- de tentatives, et la limitation ne servirait plus à rien.
create or replace function public.vault_open(p_vault_id uuid, p_verifier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_wrap jsonb; v_locked integer; v_attempts integer;
begin
  perform public.assert_vault_owner(p_vault_id);

  v_locked := public.vault_locked_for(p_vault_id);
  if v_locked > 0 then
    return jsonb_build_object('ok', false, 'error', 'locked', 'retryInSeconds', v_locked);
  end if;

  select password_wrap into v_wrap from public.vault_secrets
  where vault_id = p_vault_id and password_verifier = extensions.digest(p_verifier, 'sha256');

  if v_wrap is null then
    v_attempts := public.vault_register_failure(p_vault_id, 'password');
    return jsonb_build_object('ok', false, 'error', 'password',
      'attemptsLeft', greatest(0, 5 - v_attempts),
      'retryInSeconds', public.vault_locked_for(p_vault_id));
  end if;

  update public.vaults set failed_attempts = 0, locked_until = null, last_opened_at = now()
  where id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result, method)
  values (p_vault_id, 'vault.unlock', 'ok', 'password');

  return jsonb_build_object('ok', true, 'wrap', v_wrap);
end;
$$;

create or replace function public.vault_open_recovery(p_vault_id uuid, p_verifier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_wrap jsonb; v_locked integer;
begin
  perform public.assert_vault_owner(p_vault_id);

  v_locked := public.vault_locked_for(p_vault_id);
  if v_locked > 0 then
    return jsonb_build_object('ok', false, 'error', 'locked', 'retryInSeconds', v_locked);
  end if;

  select recovery_wrap into v_wrap from public.vault_secrets
  where vault_id = p_vault_id and recovery_verifier = extensions.digest(p_verifier, 'sha256');

  if v_wrap is null then
    perform public.vault_register_failure(p_vault_id, 'recovery');
    return jsonb_build_object('ok', false, 'error', 'recovery',
      'retryInSeconds', public.vault_locked_for(p_vault_id));
  end if;

  update public.vaults set failed_attempts = 0, locked_until = null, last_opened_at = now()
  where id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result, method)
  values (p_vault_id, 'vault.unlock', 'ok', 'recovery');

  return jsonb_build_object('ok', true, 'wrap', v_wrap);
end;
$$;

create or replace function public.vault_open_biometric(p_vault_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_wrap jsonb; v_locked integer;
begin
  perform public.assert_vault_owner(p_vault_id);

  v_locked := public.vault_locked_for(p_vault_id);
  if v_locked > 0 then
    return jsonb_build_object('ok', false, 'error', 'locked', 'retryInSeconds', v_locked);
  end if;

  select biometric_wrap into v_wrap from public.vault_secrets where vault_id = p_vault_id;
  if v_wrap is null then
    return jsonb_build_object('ok', false, 'error', 'biometric_disabled');
  end if;

  update public.vaults set failed_attempts = 0, locked_until = null, last_opened_at = now()
  where id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result, method)
  values (p_vault_id, 'vault.unlock', 'ok', 'biometric');

  return jsonb_build_object('ok', true, 'wrap', v_wrap);
end;
$$;

create or replace function public.vault_set_password(
  p_vault_id uuid, p_salt text, p_verifier text, p_wrap jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_vault_owner(p_vault_id);
  update public.vault_secrets
  set password_salt = p_salt,
      password_verifier = extensions.digest(p_verifier, 'sha256'),
      password_wrap = p_wrap
  where vault_id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result)
  values (p_vault_id, 'vault.password.changed', 'ok');
end;
$$;

create or replace function public.vault_reset_password(
  p_vault_id uuid, p_recovery_verifier text,
  p_password_salt text, p_password_verifier text, p_password_wrap jsonb,
  p_new_recovery_salt text, p_new_recovery_verifier text, p_new_recovery_wrap jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_locked integer;
begin
  perform public.assert_vault_owner(p_vault_id);

  v_locked := public.vault_locked_for(p_vault_id);
  if v_locked > 0 then
    return jsonb_build_object('ok', false, 'error', 'locked', 'retryInSeconds', v_locked);
  end if;

  if not exists (
    select 1 from public.vault_secrets
    where vault_id = p_vault_id
      and recovery_verifier = extensions.digest(p_recovery_verifier, 'sha256')
  ) then
    perform public.vault_register_failure(p_vault_id, 'recovery');
    return jsonb_build_object('ok', false, 'error', 'recovery',
      'retryInSeconds', public.vault_locked_for(p_vault_id));
  end if;

  update public.vault_secrets
  set password_salt = p_password_salt,
      password_verifier = extensions.digest(p_password_verifier, 'sha256'),
      password_wrap = p_password_wrap,
      recovery_salt = p_new_recovery_salt,
      recovery_verifier = extensions.digest(p_new_recovery_verifier, 'sha256'),
      recovery_wrap = p_new_recovery_wrap
  where vault_id = p_vault_id;

  update public.vaults
  set failed_attempts = 0, locked_until = null,
      recovery_issued_at = now(), recovery_used_at = now()
  where id = p_vault_id;

  insert into public.vault_access_log (vault_id, action, result)
  values (p_vault_id, 'vault.password.reset', 'ok');

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.vault_set_recovery(
  p_vault_id uuid, p_salt text, p_verifier text, p_wrap jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_vault_owner(p_vault_id);
  update public.vault_secrets
  set recovery_salt = p_salt,
      recovery_verifier = extensions.digest(p_verifier, 'sha256'),
      recovery_wrap = p_wrap
  where vault_id = p_vault_id;
  update public.vaults set recovery_issued_at = now(), recovery_used_at = null
  where id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result)
  values (p_vault_id, 'vault.recovery.regenerated', 'ok');
end;
$$;

create or replace function public.vault_set_biometric(
  p_vault_id uuid, p_biometric jsonb, p_wrap jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_vault_owner(p_vault_id);
  update public.vault_secrets set biometric = p_biometric, biometric_wrap = p_wrap
  where vault_id = p_vault_id;
  update public.vaults
  set protection = case when p_biometric is null then 'password' else 'password+biometric' end
  where id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result)
  values (p_vault_id,
          case when p_biometric is null then 'vault.biometrics.disabled' else 'vault.biometrics.enabled' end,
          'ok');
end;
$$;

-- ------------------------------------------------------ droits d'exécution
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut : on retire tout, puis on
-- redonne uniquement ce qui doit être appelable, et par qui.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
  end loop;
end;
$$;

grant execute on function public.card_by_slug(text)             to anon, authenticated;
grant execute on function public.register_card_scan(text, text) to anon, authenticated;
grant execute on function public.slug_available(text, uuid)     to anon, authenticated;

grant execute on function public.vault_create(text, integer, text, text, jsonb, text, text, jsonb) to authenticated;
grant execute on function public.vault_intro(uuid)                           to authenticated;
grant execute on function public.vault_open(uuid, text)                      to authenticated;
grant execute on function public.vault_open_recovery(uuid, text)             to authenticated;
grant execute on function public.vault_open_biometric(uuid)                  to authenticated;
grant execute on function public.vault_set_password(uuid, text, text, jsonb) to authenticated;
grant execute on function public.vault_set_recovery(uuid, text, text, jsonb) to authenticated;
grant execute on function public.vault_set_biometric(uuid, jsonb, jsonb)     to authenticated;
grant execute on function public.vault_log(uuid, text, text, text, text)     to authenticated;
grant execute on function public.vault_reset_password(
  uuid, text, text, text, jsonb, text, text, jsonb)                          to authenticated;

-- Tout le reste (déclencheurs, garde-fous internes, calcul des limites) reste
-- inaccessible depuis l'API. Les déclencheurs continuent de fonctionner :
-- PostgreSQL vérifie le droit d'exécution à leur création, pas à chaque appel.

-- ----------------------------------------------------------------- fichiers
--   card-assets : public en lecture (photos et logos affichés sur le mini-site)
--   vault-files : strictement privé, contenu chiffré, servi par URL signée
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('card-assets', 'card-assets', true,  5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('vault-files', 'vault-files', false, 209715200, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "images de carte lisibles par tous" on storage.objects
  for select using (bucket_id = 'card-assets');
create policy "images de carte déposées par leur propriétaire" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'card-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "images de carte remplacées par leur propriétaire" on storage.objects
  for update to authenticated using (
    bucket_id = 'card-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "images de carte supprimées par leur propriétaire" on storage.objects
  for delete to authenticated using (
    bucket_id = 'card-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "fichiers de coffre lisibles par leur propriétaire" on storage.objects
  for select to authenticated using (
    bucket_id = 'vault-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fichiers de coffre déposés par leur propriétaire" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'vault-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fichiers de coffre supprimés par leur propriétaire" on storage.objects
  for delete to authenticated using (
    bucket_id = 'vault-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
