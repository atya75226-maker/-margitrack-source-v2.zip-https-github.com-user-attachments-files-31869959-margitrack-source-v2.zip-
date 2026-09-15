-- Photo du propriétaire sur le mini-site public.
--
-- La carte affiche la photo choisie pour elle, et à défaut celle du compte.
-- Le mini-site est lu sans aucun compte : il ne peut pas aller chercher cette
-- photo lui-même, la fonction publique doit donc la lui donner. Rien d'autre
-- ne change : mêmes champs, mêmes droits, même clé de lecture par slug.
--
-- Ce qui est exposé reste ce qui est déjà public par nature — la photo
-- s'affiche sur la page que le QR Code ouvre.

create or replace function public.card_by_slug(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'template', c.template, 'theme', c.theme,
    'profile', c.profile, 'socials', c.socials, 'about', c.about,
    'activities', c.activities, 'companies', c.companies, 'services', c.services,
    'gallery', c.gallery, 'scans', c.scans, 'createdAt', c.created_at,
    'ownerPlan', p.plan,
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
