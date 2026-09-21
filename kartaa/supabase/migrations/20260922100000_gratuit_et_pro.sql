-- ============================================================================
-- Kartaa Gratuit / Kartaa Pro : ce que la base refuse
-- ----------------------------------------------------------------------------
-- L'offre gratuite doit rester utilisable : un compte, une identité, un profil
-- public, un QR Code, une carte. Ce qui relève de l'identité PROFESSIONNELLE
-- avancée passe dans l'abonnement Pro (5 000 FCFA/mois, seul abonnement).
--
-- Quatre verrous manquaient côté base — l'écran seul ne protège rien :
--
--  1. les réseaux Facebook, Instagram, Telegram et X. set_card_social_links()
--     acceptait n'importe quelle plateforme, quel que soit l'abonnement ;
--  2. les informations d'entreprise. Le déclencheur en tolérait une en gratuit ;
--     elles relèvent désormais entièrement du Pro ;
--  3. les couleurs et la typographie du mini-site. « Personnalisation avancée »
--     était vendue avec l'abonnement, et se changeait librement en gratuit ;
--  4. la mention Kartaa du mini-site. card_by_slug() renvoyait profiles.plan
--     brut : un abonnement ÉCHU y restait « pro », et l'écran comparait cette
--     valeur à « vip », qui n'existe pas — la mention s'affichait donc pour tout
--     le monde, y compris les abonnés qui l'avaient payée.
--
-- RÈGLE COMMUNE, ET ELLE EST DÉLIBÉRÉE : on ne refuse que ce qui AJOUTE.
-- Un abonnement qui prend fin ne fait rien disparaître. Les réseaux, les
-- entreprises et les cartes déjà enregistrés restent en base, restent
-- modifiables et corrigeables ; ils cessent seulement de pouvoir s'étendre, et
-- redeviennent pleinement accessibles dès le renouvellement. Aucune donnée
-- n'est supprimée nulle part dans ce fichier.
-- ============================================================================

-- ------------------------------------------ les réseaux réservés à l'offre Pro
-- Une seule liste, lue par le déclencheur comme par l'application. Téléphone,
-- WhatsApp et e-mail n'en font pas partie : ce sont les coordonnées de base,
-- et elles restent gratuites. TikTok, YouTube, LinkedIn, Snapchat, les sites
-- web et les autres liens non plus.
create or replace function public.pro_social_platforms()
returns text[] language sql immutable set search_path = '' as $$
  select array['facebook', 'instagram', 'telegram', 'x']::text[];
$$;

comment on function public.pro_social_platforms() is
  'Réseaux inclus dans l''abonnement Pro : Facebook, Instagram, Telegram et X. Doit rester aligné sur PRO_SOCIAL_KEYS (src/config/app.config.js).';

/**
 * Remplace d'un bloc les liens d'une carte, en refusant qu'un compte gratuit
 * AJOUTE un réseau Pro.
 *
 * La fonction efface puis réinsère : « conserver l'existant » se vérifie donc
 * avant l'effacement, en comparant les adresses. Un lien Pro déjà enregistré
 * peut être renommé, déplacé ou supprimé ; seule une adresse nouvelle est
 * refusée. C'est ce qui permet à un abonnement échu de garder ses réseaux
 * intacts sans pouvoir en ajouter.
 */
create or replace function public.set_card_social_links(p_card_id uuid, p_links jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner    uuid;
  v_count    integer;
  v_pro      boolean;
  v_nouveau  text;
begin
  select user_id into v_owner from public.cards where id = p_card_id and user_id = auth.uid();
  if v_owner is null then
    raise exception 'Carte introuvable.' using errcode = 'no_data_found';
  end if;

  v_pro := public.plan_of(v_owner) = 'pro';

  if not v_pro then
    -- Première adresse d'un réseau Pro qui n'existait pas déjà sur cette carte.
    select l.valeur ->> 'platform' into v_nouveau
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as l(valeur)
    where l.valeur ->> 'platform' = any (public.pro_social_platforms())
      and coalesce(trim(l.valeur ->> 'url'), '') <> ''
      and not exists (
        select 1 from public.social_links s
        where s.card_id = p_card_id
          and s.platform = l.valeur ->> 'platform'
          and lower(trim(s.url)) = lower(trim(l.valeur ->> 'url')))
    limit 1;

    if v_nouveau is not null then
      raise exception 'Ce réseau est inclus dans l''abonnement Kartaa Pro : %', v_nouveau
        using errcode = 'check_violation';
    end if;
  end if;

  delete from public.social_links where card_id = p_card_id;

  insert into public.social_links (card_id, platform, title, url, display_order, is_active)
  select p_card_id,
         l.valeur ->> 'platform',
         coalesce(l.valeur ->> 'title', ''),
         trim(l.valeur ->> 'url'),
         (l.rang - 1)::integer,
         coalesce((l.valeur ->> 'isActive')::boolean, true)
  from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) with ordinality as l(valeur, rang)
  where coalesce(trim(l.valeur ->> 'url'), '') <> '';

  select count(*) into v_count from public.social_links where card_id = p_card_id;
  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

revoke all on function public.set_card_social_links(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_card_social_links(uuid, jsonb) to authenticated;

-- --------------------------------- le mini-site public connaît le plan EFFECTIF
-- `ownerPlan` valait profiles.plan, sans tenir compte de l'échéance. C'est cette
-- valeur qui décide de la mention Kartaa en bas du mini-site : elle doit dire
-- « pro » exactement quand l'abonnement est en cours, et « free » sinon.
create or replace function public.card_by_slug(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'template', c.template, 'theme', c.theme,
    'profile', c.profile, 'socials', c.socials, 'about', c.about,
    'activities', c.activities, 'companies', c.companies, 'services', c.services,
    'gallery', c.gallery, 'scans', c.scans, 'createdAt', c.created_at,
    'ownerPlan', public.plan_of(c.user_id),
    'ownerAvatarUrl', coalesce(p.avatar_url, ''),
    'socialLinks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'platform', l.platform, 'title', l.title,
               'url', l.url, 'displayOrder', l.display_order)
             order by l.display_order, l.created_at)
      from public.social_links l
      where l.card_id = c.id and l.is_active), '[]'::jsonb))
  from public.cards c
  join public.profiles p on p.id = c.user_id
  where lower(c.slug) = lower(p_slug);
$$;

-- --------------- entreprise, couleurs et typographie : l'unique déclencheur
-- Cette version remplace celle de la migration 20260916140000. Deux règles
-- changent :
--
--  • LES ENTREPRISES. Le seuil passe de 1 à 0 pour un compte gratuit : les
--    informations d'entreprise relèvent désormais entièrement du Pro.
--    `greatest(v_avant_entreprises, 0)` laisse intact ce qui existe déjà — un
--    compte qui avait une entreprise la garde et peut la supprimer.
--
--  • LES COULEURS ET LA TYPOGRAPHIE du mini-site.
-- « Personnalisation avancée » figure dans ce qui est vendu avec Kartaa Pro.
-- Elle n'était tenue nulle part : les couleurs et la police du mini-site se
-- changeaient librement en offre gratuite. On vend donc, ou on verrouille —
-- laisser les deux en l'état revient à faire payer ce qui est déjà donné.
--
-- La règle suit celle des autres options : on ne refuse que le CHANGEMENT.
-- Un thème déjà enregistré reste en place, reste affiché, et revient tel quel
-- au renouvellement de l'abonnement. La création d'une carte n'est pas
-- contrainte : l'assistant y envoie les couleurs du modèle Standard, et la
-- carte suivante d'un compte gratuit n'existe pas — la limite d'une carte s'en
-- charge déjà (plan_limits).
create or replace function public.enforce_card_plan_features()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pro boolean;
  v_avant_galerie integer := 0;
  v_avant_entreprises integer := 0;
  v_avant_activites integer := 0;
  v_avant_domaine boolean := false;
  v_avant_modele text := 'standard';
  v_avant_theme jsonb := null;
begin
  v_pro := public.plan_of(new.user_id) = 'pro';
  if v_pro then return new; end if;

  if tg_op = 'UPDATE' then
    v_avant_galerie     := coalesce(jsonb_array_length(old.gallery), 0);
    v_avant_entreprises := coalesce(jsonb_array_length(old.companies), 0);
    v_avant_activites   := coalesce(jsonb_array_length(old.activities), 0);
    v_avant_domaine     := old.custom_domain is not null;
    v_avant_modele      := old.template;
    v_avant_theme       := old.theme;
  end if;

  if new.template <> 'standard' and new.template <> v_avant_modele then
    raise exception 'Les modèles Premium et VIP sont inclus dans l''abonnement Kartaa Pro.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and new.theme is distinct from v_avant_theme then
    raise exception 'Les couleurs et la typographie du mini-site sont incluses dans l''abonnement Kartaa Pro.'
      using errcode = 'check_violation';
  end if;

  if new.custom_domain is not null and not v_avant_domaine then
    raise exception 'Le domaine personnalisé est inclus dans l''abonnement Kartaa Pro.'
      using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(new.gallery), 0) > greatest(v_avant_galerie, 0)
     and coalesce(jsonb_array_length(new.gallery), 0) > 0 then
    raise exception 'La galerie photos est incluse dans l''abonnement Kartaa Pro.'
      using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(new.companies), 0) > greatest(v_avant_entreprises, 0) then
    raise exception 'Les informations d''entreprise sont incluses dans l''abonnement Kartaa Pro.'
      using errcode = 'check_violation';
  end if;

  if coalesce(jsonb_array_length(new.activities), 0) > greatest(v_avant_activites, 1) then
    raise exception 'Plusieurs activités sur une même carte : c''est inclus dans l''abonnement Kartaa Pro.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
