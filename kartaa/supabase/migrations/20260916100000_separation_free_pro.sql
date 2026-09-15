-- ============================================================================
-- Séparation Gratuit / Pro : ce que la base refuse, et non plus seulement l'écran
-- ----------------------------------------------------------------------------
-- Trois choses n'étaient protégées que par l'interface :
--
--  1. la colonne « plan » elle-même. La politique RLS autorise un compte à
--     modifier sa ligne de profil — plan compris. Une commande depuis la console
--     du navigateur suffisait à devenir Pro ;
--  2. les modèles Premium et VIP, le domaine personnalisé, la galerie, les
--     entreprises et activités multiples : un appel direct à l'API passait ;
--  3. les statistiques avancées, lisibles par n'importe quel compte connecté.
--
-- Le nombre de cartes, de coffres et le quota de stockage étaient déjà tenus par
-- des déclencheurs : on n'y touche pas.
-- ============================================================================

-- ----------------------------------------------------------- le plan lui-même

-- SECURITY INVOKER, et non DEFINER : dans une fonction DEFINER, current_user
-- vaut le propriétaire de la fonction et ne permet donc jamais de reconnaître un
-- appel venu du navigateur. Un déclencheur BEFORE n'a besoin d'aucun privilège
-- particulier pour corriger NEW.
create or replace function public.protect_plan_column()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.plan is distinct from old.plan
     and coalesce(current_setting('kartaa.plan_change', true), '') <> 'autorise'
     and current_user in ('authenticated', 'anon', 'authenticator')
  then
    -- Ramené silencieusement : le client envoie le profil en bloc, lever une
    -- exception l'empêcherait d'enregistrer son prénom.
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_plan on public.profiles;
create trigger profiles_protect_plan before update on public.profiles
  for each row execute function public.protect_plan_column();

comment on function public.protect_plan_column() is
  'Empêche un compte de modifier lui-même son abonnement. Seul set_user_plan() en a le droit.';

-- Seule voie pour changer un abonnement. Fermée au navigateur : elle servira à
-- l'encaissement quand il existera, et à l'activation manuelle d'ici là.
create or replace function public.set_user_plan(p_user_id uuid, p_plan text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_plan not in ('free', 'pro') then
    raise exception 'Plan inconnu : %', p_plan;
  end if;
  perform set_config('kartaa.plan_change', 'autorise', true);
  update public.profiles set plan = p_plan where id = p_user_id;
  perform set_config('kartaa.plan_change', '', true);
end;
$$;

revoke all on function public.set_user_plan(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------- demandes d'abonnement
-- Aucun encaissement n'est branché. Plutôt que de faire croire à un paiement
-- réussi, on enregistre l'intention : qui veut passer Pro, et quand.
create table if not exists public.subscription_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       text not null default 'pro' check (plan = 'pro'),
  amount     integer not null default 5000,
  currency   text not null default 'XOF',
  status     text not null default 'pending' check (status in ('pending', 'activated', 'cancelled')),
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_requests_user_idx
  on public.subscription_requests (user_id, created_at desc);

alter table public.subscription_requests enable row level security;

drop policy if exists "demandes visibles par leur auteur" on public.subscription_requests;
create policy "demandes visibles par leur auteur" on public.subscription_requests
  for select using ((select auth.uid()) = user_id);

drop policy if exists "demandes créées par leur auteur" on public.subscription_requests;
create policy "demandes créées par leur auteur" on public.subscription_requests
  for insert with check ((select auth.uid()) = user_id);

comment on table public.subscription_requests is
  'Intentions d''abonnement Pro (5 000 FCFA/mois). Une demande n''active rien : seul set_user_plan() change un plan.';

-- ------------------------------------------------ options réservées au Pro
-- On ne refuse que ce qui AUGMENTE au-delà de la limite. Un compte qui repasse
-- en gratuit garde ses données ; il ne peut plus en ajouter. Refuser tout
-- enregistrement l'empêcherait même de corriger une faute de frappe.
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
  v_pro := coalesce((select plan from public.profiles where id = new.user_id), 'free') = 'pro';
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

drop trigger if exists cards_plan_features on public.cards;
create trigger cards_plan_features before insert or update on public.cards
  for each row execute function public.enforce_card_plan_features();

comment on function public.enforce_card_plan_features() is
  'Refuse côté base les options réservées au Pro. Ne bloque que ce qui augmente : les données déjà en place restent modifiables après un retour au plan gratuit.';

-- --------------------------------------------------- statistiques avancées
create or replace function public.card_event_counts(p_card_id uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if coalesce((select plan from public.profiles where id = auth.uid()), 'free') <> 'pro' then
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
  if coalesce((select plan from public.profiles where id = auth.uid()), 'free') <> 'pro' then
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

revoke all on function public.card_event_counts(uuid, integer) from public, anon, authenticated;
revoke all on function public.my_event_counts(integer)          from public, anon, authenticated;
grant execute on function public.card_event_counts(uuid, integer) to authenticated;
grant execute on function public.my_event_counts(integer)         to authenticated;
