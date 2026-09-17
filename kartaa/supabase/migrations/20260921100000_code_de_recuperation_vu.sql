-- Savoir si le code de récupération a bien été mis à l'abri.
--
-- Le code n'est affiché qu'une fois, à la création. Si quoi que ce soit
-- interrompt ce moment — le système qui reprend la main, un téléphone qui ferme
-- l'application, une page quittée trop vite — le coffre existe mais son
-- propriétaire n'a jamais vu son code, et rien ne le lui dit. Il ne l'apprend
-- qu'en oubliant son mot de passe, c'est-à-dire trop tard.
--
-- La colonne ci-dessous enregistre le moment où le propriétaire confirme
-- l'avoir conservé. Tant qu'elle est vide, le coffre affiche un avertissement
-- et propose d'en générer un nouveau. Elle ne contient aucun secret : une date.
--
-- Les coffres déjà créés sont considérés comme vus : leur code a été présenté
-- selon l'ancien parcours, et les couvrir d'avertissements rétroactifs
-- n'apprendrait rien à personne.

alter table public.vaults
  add column if not exists recovery_seen_at timestamptz;

update public.vaults set recovery_seen_at = created_at where recovery_seen_at is null;

create or replace function public.vault_recovery_seen(p_vault_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_vault_owner(p_vault_id);
  update public.vaults set recovery_seen_at = now() where id = p_vault_id;
end;
$$;

revoke all on function public.vault_recovery_seen(uuid) from public, anon, authenticated;
grant execute on function public.vault_recovery_seen(uuid) to authenticated;
