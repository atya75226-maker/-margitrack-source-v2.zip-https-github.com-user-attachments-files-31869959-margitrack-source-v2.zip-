-- La photo donnée par le fournisseur d'identité rejoint le profil.
--
-- handle_new_user() copie bien la photo de Google dans profiles.avatar_url,
-- mais son déclencheur ne s'exécutait qu'à la CRÉATION de la ligne auth.users.
-- Or la photo n'arrive pas toujours à cet instant : elle est ajoutée ensuite,
-- quand l'identité Google est rattachée au compte, par une simple mise à jour.
--
-- Conséquence : la photo restait dans le jeton et n'atteignait jamais le profil.
-- Comme la carte et le mini-site lisent le profil, le propriétaire voyait ses
-- initiales alors que son compte portait bien une photo. L'application la
-- montrait même une fraction de seconde au démarrage — elle lit alors le jeton —
-- avant de la faire disparaître au chargement du profil.
--
-- La fonction ne remplit que ce qui est vide : une photo choisie dans Kartaa
-- n'est jamais écrasée par celle du fournisseur, et retirer sa photo la laisse
-- retirée.

create trigger on_auth_user_updated
  after update on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.handle_new_user();

-- Rattrapage des comptes déjà créés : ceux dont le jeton porte une photo que
-- le profil n'a jamais reçue.
update public.profiles p
set avatar_url = coalesce(
      nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(u.raw_user_meta_data ->> 'picture', ''),
      '')
from auth.users u
where u.id = p.id
  and coalesce(p.avatar_url, '') = ''
  and coalesce(
        nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
        nullif(u.raw_user_meta_data ->> 'picture', ''),
        '') <> '';
