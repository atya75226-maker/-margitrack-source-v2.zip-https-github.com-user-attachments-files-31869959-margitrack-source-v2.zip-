-- Stockage du Coffre Sécurité : 20 Mo pour l'offre gratuite.
--
-- L'offre gratuite accordait 200 Mo. La capacité passe à 20 Mo, l'offre Pro
-- garde ses 20 Go — c'est le même et unique abonnement, à 5 000 FCFA par mois :
-- aucune formule n'est créée pour le stockage.
--
-- La limite n'est pas une phrase dans l'écran : le déclencheur ci-dessous refuse
-- l'enregistrement d'un fichier qui ferait dépasser le quota, quelle que soit la
-- manière dont l'appel arrive. Il additionne les tailles réelles de tous les
-- fichiers du compte, pas une estimation, et un fichier supprimé rend aussitôt
-- sa place puisque la somme est recalculée à chaque fois.
--
-- AUCUN FICHIER EXISTANT N'EST SUPPRIMÉ. Un compte déjà au-dessus de la nouvelle
-- limite conserve tout ce qu'il a ; il ne peut simplement plus rien ajouter tant
-- qu'il n'a pas libéré de la place ou choisi Pro.

create or replace function public.plan_limits(p_plan text)
returns table (max_cards integer, max_vaults integer, max_storage_bytes bigint)
language sql immutable set search_path = '' as $$
  select
    case p_plan when 'pro' then 2147483647 else 1 end,
    case p_plan when 'pro' then 2147483647 else 1 end,
    -- 20 Go pour Pro, 20 Mo pour l'offre gratuite.
    case p_plan when 'pro' then 21474836480::bigint else 20971520::bigint end;
$$;

-- Le remplacement d'un fichier passe par une mise à jour de sa taille : sans
-- cette ligne, elle échapperait au quota. L'ancienne taille est alors retirée du
-- total — elle est remplacée, pas ajoutée.
create or replace function public.enforce_storage_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_max bigint; v_used bigint;
begin
  select v.user_id into v_owner from public.vaults v where v.id = new.vault_id;
  select max_storage_bytes into v_max from public.plan_limits(public.plan_of(v_owner));

  select coalesce(sum(f.size), 0) into v_used
  from public.vault_files f join public.vaults v on v.id = f.vault_id
  where v.user_id = v_owner;

  if TG_OP = 'UPDATE' then
    v_used := v_used - old.size;
  end if;

  if v_used + new.size > v_max then
    raise exception 'Espace de stockage insuffisant pour votre offre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists vault_files_quota on public.vault_files;
create trigger vault_files_quota
  before insert or update of size on public.vault_files
  for each row execute function public.enforce_storage_quota();
