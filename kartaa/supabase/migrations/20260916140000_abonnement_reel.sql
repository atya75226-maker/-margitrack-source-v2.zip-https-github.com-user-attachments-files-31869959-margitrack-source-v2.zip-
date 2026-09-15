-- ============================================================================
-- Un abonnement Pro qui vient d'un paiement, et qui expire
-- ----------------------------------------------------------------------------
-- « Pro » était une valeur dans profiles.plan, sans date ni origine : rien ne
-- reliait un paiement à un compte, et un abonnement ne pouvait pas prendre fin.
-- La colonne était déjà protégée contre l'écriture par le navigateur ; il lui
-- manquait une vérité.
--
-- Le seul chemin vers Pro est désormais : paiement chez le prestataire →
-- notification signée → fonction Edge chariow-webhook → activate_pro().
-- ============================================================================

alter table public.profiles
  add column if not exists pro_until  timestamptz,
  add column if not exists pro_source text
    check (pro_source is null or pro_source in ('chariow', 'manuel'));

comment on column public.profiles.pro_until is
  'Fin de l''abonnement Pro. NULL avec plan = pro signifie un accès accordé à la main, sans échéance.';

-- Journal des évènements du prestataire : trace, et surtout idempotence — un
-- webhook est rejoué en cas de doute, il ne doit pas prolonger deux fois.
create table if not exists public.subscription_events (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null default 'chariow',
  event      text not null,
  reference  text not null,
  email      text,
  user_id    uuid references auth.users (id) on delete set null,
  amount     integer,
  currency   text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists subscription_events_reference_idx
  on public.subscription_events (provider, event, reference);

alter table public.subscription_events enable row level security;

drop policy if exists "évènements visibles par le compte concerné" on public.subscription_events;
create policy "évènements visibles par le compte concerné" on public.subscription_events
  for select using ((select auth.uid()) = user_id);

comment on table public.subscription_events is
  'Notifications reçues du prestataire de paiement. Aucune écriture depuis le navigateur : seule la fonction Edge, avec la clé de service, y écrit.';

-- ------------------------------------------------- la seule source de vérité
-- Toutes les limites du produit passent par current_plan() : lui faire tenir
-- compte de l'échéance suffit à ce qu'un abonnement expiré perde ses droits
-- partout.
create or replace function public.current_plan()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p.plan = 'pro' and (p.pro_until is null or p.pro_until > now()) then 'pro'
    else 'free'
  end
  from public.profiles p where p.id = auth.uid();
$$;

-- Version nommée, pour les déclencheurs qui connaissent le propriétaire sans
-- passer par auth.uid().
create or replace function public.plan_of(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when p.plan = 'pro' and (p.pro_until is null or p.pro_until > now()) then 'pro'
      else 'free'
    end
    from public.profiles p where p.id = p_user_id), 'free');
$$;

create or replace function public.my_subscription()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan', public.current_plan(),
    'storedPlan', p.plan,
    'proUntil', p.pro_until,
    'source', p.pro_source,
    'status', case
      when p.plan <> 'pro' then 'free'
      when p.pro_until is null then 'active'
      when p.pro_until > now() then 'active'
      else 'expired'
    end)
  from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.my_subscription() from public, anon, authenticated;
grant execute on function public.my_subscription() to authenticated;

-- --------------------------------------------- activation par le prestataire
create or replace function public.activate_pro(
  p_email text, p_days integer default 30,
  p_reference text default null, p_event text default 'successful.sale',
  p_amount integer default null, p_currency text default 'XOF',
  p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_depart timestamptz; v_fin timestamptz;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'compte introuvable', 'email', p_email);
  end if;

  -- Idempotence : un même paiement rejoué ne prolonge pas deux fois.
  if p_reference is not null and exists (
    select 1 from public.subscription_events
    where provider = 'chariow' and event = p_event and reference = p_reference
  ) then
    return jsonb_build_object('ok', true, 'error', 'déjà traité', 'userId', v_user);
  end if;

  -- Un renouvellement prolonge l'échéance en cours plutôt que de la remplacer.
  select greatest(coalesce(pro_until, now()), now()) into v_depart
  from public.profiles where id = v_user;
  v_fin := v_depart + make_interval(days => greatest(1, coalesce(p_days, 30)));

  perform set_config('kartaa.plan_change', 'autorise', true);
  update public.profiles
  set plan = 'pro', pro_until = v_fin, pro_source = 'chariow'
  where id = v_user;
  perform set_config('kartaa.plan_change', '', true);

  insert into public.subscription_events (provider, event, reference, email, user_id, amount, currency, payload)
  values ('chariow', p_event, coalesce(p_reference, gen_random_uuid()::text),
          lower(trim(p_email)), v_user, p_amount, p_currency, p_payload)
  on conflict do nothing;

  update public.subscription_requests set status = 'activated'
  where user_id = v_user and status = 'pending';

  return jsonb_build_object('ok', true, 'userId', v_user, 'proUntil', v_fin);
end;
$$;

create or replace function public.revoke_pro(
  p_email text, p_event text default 'license.expired', p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'compte introuvable');
  end if;

  perform set_config('kartaa.plan_change', 'autorise', true);
  update public.profiles set plan = 'free', pro_until = now(), pro_source = null where id = v_user;
  perform set_config('kartaa.plan_change', '', true);

  insert into public.subscription_events (provider, event, reference, email, user_id, payload)
  values ('chariow', p_event, gen_random_uuid()::text, lower(trim(p_email)), v_user, p_payload);

  return jsonb_build_object('ok', true, 'userId', v_user);
end;
$$;

revoke all on function public.activate_pro(text, integer, text, text, integer, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.revoke_pro(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.plan_of(uuid) from public, anon, authenticated;

-- ------------------------------- les contrôles lisent le plan EFFECTIF
-- Quatre d'entre eux lisaient profiles.plan directement : pour eux, un
-- abonnement échu restait Pro.
create or replace function public.enforce_card_plan_features()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pro boolean;
  v_avant_galerie integer := 0;
  v_avant_entreprises integer := 0;
  v_avant_activites integer := 0;
  v_avant_domaine boolean := false;
  v_avant_modele text := 'standard';
begin
  v_pro := public.plan_of(new.user_id) = 'pro';
  if v_pro then return new; end if;

  if tg_op = 'UPDATE' then
    v_avant_galerie     := coalesce(jsonb_array_length(old.gallery), 0);
    v_avant_entreprises := coalesce(jsonb_array_length(old.companies), 0);
    v_avant_activites   := coalesce(jsonb_array_length(old.activities), 0);
    v_avant_domaine     := old.custom_domain is not null;
    v_avant_modele      := old.template;
  end if;

  if new.template <> 'standard' and new.template <> v_avant_modele then
    raise exception 'Les modèles Premium et VIP sont inclus dans l''abonnement Pro.'
      using errcode = 'check_violation';
  end if;

  if new.custom_domain is not null and not v_avant_domaine then
    raise exception 'Le domaine personnalisé est inclus dans l''abonnement Pro.'
      using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(new.gallery), 0) > greatest(v_avant_galerie, 0)
     and coalesce(jsonb_array_length(new.gallery), 0) > 0 then
    raise exception 'La galerie photos est incluse dans l''abonnement Pro.'
      using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(new.companies), 0) > greatest(v_avant_entreprises, 1) then
    raise exception 'Une deuxième entreprise est incluse dans l''abonnement Pro.'
      using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(new.activities), 0) > greatest(v_avant_activites, 1) then
    raise exception 'Plusieurs activités sur une même carte : c''est inclus dans l''abonnement Pro.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.card_event_counts(p_card_id uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.plan_of(auth.uid()) <> 'pro' then
    return jsonb_build_object('locked', 'pro');
  end if;
  if not exists (select 1 from public.cards where id = p_card_id and user_id = auth.uid()) then
    return '{}'::jsonb;
  end if;

  select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) into v_result
  from (
    select kind, count(*) as n
    from public.card_events
    where card_id = p_card_id
      and created_at > now() - make_interval(days => greatest(1, p_days))
    group by kind) totaux;

  return v_result;
end;
$$;

create or replace function public.my_event_counts(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if public.plan_of(auth.uid()) <> 'pro' then
    return jsonb_build_object('locked', 'pro');
  end if;

  select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) into v_result
  from (
    select e.kind, count(*) as n
    from public.card_events e
    join public.cards c on c.id = e.card_id
    where c.user_id = auth.uid()
      and e.created_at > now() - make_interval(days => greatest(1, p_days))
    group by e.kind) totaux;

  return v_result;
end;
$$;

create or replace function public.enforce_storage_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_max bigint; v_used bigint;
begin
  select v.user_id into v_owner from public.vaults v where v.id = new.vault_id;
  select max_storage_bytes into v_max from public.plan_limits(public.plan_of(v_owner));

  select coalesce(sum(f.size), 0) into v_used
  from public.vault_files f join public.vaults v on v.id = f.vault_id
  where v.user_id = v_owner;

  if v_used + new.size > v_max then
    raise exception 'Espace de stockage insuffisant pour votre offre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
