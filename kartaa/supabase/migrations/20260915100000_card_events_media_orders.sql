-- ============================================================================
-- Ce que devient une carte après le scan : mesure, supports physiques, commandes
-- ----------------------------------------------------------------------------
-- Seuls les scans étaient comptés. On ne savait donc pas si un mini-site ouvert
-- menait à un appel, à un message WhatsApp ou à rien du tout — c'est pourtant la
-- seule chose qui intéresse celui qui distribue sa carte.
-- ============================================================================

create table if not exists public.card_events (
  id         bigint generated always as identity primary key,
  card_id    uuid not null references public.cards (id) on delete cascade,
  kind       text not null check (kind in
               ('view', 'call', 'whatsapp', 'email', 'social', 'website', 'vcard', 'address')),
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists card_events_card_id_idx on public.card_events (card_id, created_at desc);
create index if not exists card_events_kind_idx on public.card_events (card_id, kind);

alter table public.card_events enable row level security;

-- Lecture réservée au propriétaire de la carte. Aucune politique d'insertion :
-- l'enregistrement passe uniquement par register_card_event(), qui ne révèle
-- rien et ne permet pas de viser la carte d'autrui autrement que par son
-- adresse publique.
drop policy if exists "événements visibles par le propriétaire de la carte" on public.card_events;
create policy "événements visibles par le propriétaire de la carte" on public.card_events
  for select using (exists (
    select 1 from public.cards c
    where c.id = card_events.card_id and c.user_id = (select auth.uid())));

comment on table public.card_events is
  'Interactions sur un mini-site public : ouverture, appel, WhatsApp, e-mail, réseau social. Alimentée par register_card_event().';

create or replace function public.register_card_event(
  p_slug text, p_kind text, p_detail text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_card_id uuid;
begin
  if p_kind not in ('view','call','whatsapp','email','social','website','vcard','address') then
    return;
  end if;
  select id into v_card_id from public.cards where lower(slug) = lower(p_slug);
  if v_card_id is null then return; end if;

  insert into public.card_events (card_id, kind, detail)
  values (v_card_id, p_kind, left(nullif(trim(coalesce(p_detail, '')), ''), 60));
end;
$$;

-- Compteurs prêts à afficher, sans exposer la table ligne à ligne.
create or replace function public.card_event_counts(p_card_id uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
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

-- Totaux de toutes les cartes du compte, en un seul appel : interroger carte par
-- carte multiplierait les allers-retours pour un chiffre qui s'affiche d'un bloc.
create or replace function public.my_event_counts(p_days integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
  from (
    select e.kind, count(*) as n
    from public.card_events e
    join public.cards c on c.id = e.card_id
    where c.user_id = auth.uid()
      and e.created_at > now() - make_interval(days => greatest(1, p_days))
    group by e.kind) totaux;
$$;

-- ---------------------------------------------------------- supports physiques
-- Préparation NFC : une puce n'est qu'un support de plus menant au même
-- mini-site. On enregistre le lien support → carte dès maintenant pour ne pas
-- avoir à déplacer les données plus tard ; rien ne l'utilise encore.
create table if not exists public.card_media (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  kind       text not null check (kind in ('qr', 'nfc')),
  label      text,
  serial     text,
  status     text not null default 'planned' check (status in ('planned', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_media_card_id_idx on public.card_media (card_id);
create unique index if not exists card_media_serial_idx on public.card_media (serial) where serial is not null;

alter table public.card_media enable row level security;

drop policy if exists "supports visibles par le propriétaire" on public.card_media;
create policy "supports visibles par le propriétaire" on public.card_media
  for select using (exists (
    select 1 from public.cards c where c.id = card_media.card_id and c.user_id = (select auth.uid())));
drop policy if exists "supports gérés par le propriétaire" on public.card_media;
create policy "supports gérés par le propriétaire" on public.card_media
  for all using (exists (
    select 1 from public.cards c where c.id = card_media.card_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.cards c where c.id = card_media.card_id and c.user_id = (select auth.uid())));

comment on table public.card_media is
  'Supports physiques d''une carte : QR imprimé, puce NFC. Préparé pour une future intégration ; aucun parcours ne s''en sert encore.';

-- ------------------------------------------------------------------ commandes
-- La demande de carte physique affichait « Demande enregistrée » sans rien
-- enregistrer. Elle est désormais conservée, sans paiement ni abonnement
-- supplémentaire : c'est une liste d'attente, rien de plus.
create table if not exists public.card_orders (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  template   text not null,
  quantity   integer not null default 100 check (quantity between 1 and 10000),
  address    text,
  note       text,
  status     text not null default 'waiting' check (status in ('waiting', 'contacted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists card_orders_user_id_idx on public.card_orders (user_id, created_at desc);

alter table public.card_orders enable row level security;

drop policy if exists "commandes visibles par leur auteur" on public.card_orders;
create policy "commandes visibles par leur auteur" on public.card_orders
  for select using ((select auth.uid()) = user_id);
drop policy if exists "commandes créées par leur auteur" on public.card_orders;
create policy "commandes créées par leur auteur" on public.card_orders
  for insert with check ((select auth.uid()) = user_id
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid())));

comment on table public.card_orders is
  'Demandes de cartes imprimées, en attente d''une intégration d''impression. Aucun paiement : l''abonnement Pro reste le seul.';

-- -------------------------------------------------------------------- droits
revoke all on function public.register_card_event(text, text, text) from public, anon, authenticated;
revoke all on function public.card_event_counts(uuid, integer)      from public, anon, authenticated;
revoke all on function public.my_event_counts(integer)              from public, anon, authenticated;

grant execute on function public.register_card_event(text, text, text) to anon, authenticated;
grant execute on function public.card_event_counts(uuid, integer)      to authenticated;
grant execute on function public.my_event_counts(integer)              to authenticated;
