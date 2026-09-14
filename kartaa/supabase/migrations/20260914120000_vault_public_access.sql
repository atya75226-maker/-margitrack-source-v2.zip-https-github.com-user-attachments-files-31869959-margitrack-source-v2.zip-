-- ============================================================================
-- Ouverture d'un coffre sans compte utilisateur
-- ----------------------------------------------------------------------------
-- Jusqu'ici, toutes les fonctions vault_* commençaient par assert_vault_owner() :
-- il fallait être connecté AU COMPTE PROPRIÉTAIRE pour seulement voir l'écran de
-- déverrouillage. Le QR Code d'un coffre était donc inutilisable par la personne
-- à qui on le montre — c'est-à-dire par tout le monde.
--
-- Deux authentifications distinctes cohabitent désormais :
--   * le COMPTE, qui donne au propriétaire la gestion de ses cartes et coffres ;
--   * le MOT DE PASSE DU COFFRE, qui donne accès à son contenu, avec ou sans compte.
--
-- Ce que le serveur continue de ne jamais voir : le mot de passe, le code de
-- récupération et la clé en clair. Le client dérive un « vérificateur » par
-- PBKDF2 ; le serveur n'en garde qu'une empreinte SHA-256 et refuse de livrer la
-- clé chiffrée tant qu'elle ne correspond pas. Le comptage des tentatives reste
-- côté serveur, donc infalsifiable depuis le navigateur.
-- ============================================================================

-- Une ouverture réussie ouvre une session de coffre : un jeton aléatoire de 256
-- bits dont seule l'empreinte est conservée. Il sert ensuite à lire la liste des
-- fichiers et à obtenir leurs URL signées, sans rien redemander.
create table if not exists public.vault_sessions (
  token_hash   bytea primary key,
  vault_id     uuid not null references public.vaults (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_used_at timestamptz not null default now()
);

create index if not exists vault_sessions_vault_id_idx on public.vault_sessions (vault_id);
create index if not exists vault_sessions_expires_at_idx on public.vault_sessions (expires_at);

alter table public.vault_sessions enable row level security;

comment on table public.vault_sessions is
  'Sessions de coffre ouvertes par mot de passe. RLS active sans aucune politique : seules les fonctions SECURITY DEFINER y accèdent.';

-- --------------------------------------------------------------- jetons

create or replace function public.vault_session_issue(p_vault_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text; v_expire timestamptz;
begin
  delete from public.vault_sessions where expires_at < now() - interval '1 day';
  v_token  := encode(extensions.gen_random_bytes(32), 'hex');
  v_expire := now() + interval '30 minutes';
  insert into public.vault_sessions (token_hash, vault_id, expires_at)
  values (extensions.digest(v_token, 'sha256'), p_vault_id, v_expire);
  return jsonb_build_object('token', v_token, 'expiresAt', v_expire);
end;
$$;

comment on function public.vault_session_issue(uuid) is
  'Usage interne : appelée par les fonctions d''ouverture après vérification du mot de passe.';

create or replace function public.vault_session_vault(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  update public.vault_sessions set last_used_at = now()
  where token_hash = extensions.digest(p_token, 'sha256') and expires_at > now()
  returning vault_id into v_id;
  return v_id;
end;
$$;

create or replace function public.vault_session_close(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.vault_sessions where token_hash = extensions.digest(p_token, 'sha256');
$$;

-- Le nom du coffre, ses dossiers et ses fichiers : livrés seulement sur jeton,
-- donc seulement après que le mot de passe a été vérifié.
create or replace function public.vault_session_content(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_result jsonb;
begin
  v_id := public.vault_session_vault(p_token);
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'session');
  end if;

  select jsonb_build_object(
    'ok', true,
    'vault', jsonb_build_object('id', v.id, 'name', v.name, 'folders', v.folders,
                                'protection', v.protection),
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.name, 'mime', f.mime, 'category', f.category,
        'size', f.size, 'folderId', f.folder_id, 'iv', f.iv, 'addedAt', f.added_at)
        order by f.added_at desc)
      from public.vault_files f where f.vault_id = v.id), '[]'::jsonb))
  into v_result
  from public.vaults v where v.id = v_id;

  return coalesce(v_result, jsonb_build_object('ok', false, 'error', 'session'));
end;
$$;

-- Le chemin de stockage ne sort d'ici que sur jeton valable : c'est lui qui
-- permet ensuite de demander une URL signée de courte durée.
create or replace function public.vault_session_file(p_token text, p_file_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_file record;
begin
  v_id := public.vault_session_vault(p_token);
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'session'); end if;

  select * into v_file from public.vault_files where id = p_file_id and vault_id = v_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  insert into public.vault_access_log (vault_id, action, result, method, detail)
  values (v_id, 'file.opened', 'ok', 'qr', left(v_file.name, 200));

  return jsonb_build_object('ok', true, 'path', v_file.storage_path,
                            'iv', v_file.iv, 'mime', v_file.mime, 'name', v_file.name);
end;
$$;

-- ------------------------------------------------- ouverture sans compte

-- Ce qui peut être lu AVANT le mot de passe : les sels, publics par nature, et
-- l'état de verrouillage. Ni le nom du coffre, ni la clé chiffrée, ni la liste
-- des fichiers — un inconnu qui scanne le code ne doit rien apprendre du contenu.
create or replace function public.vault_intro(p_vault_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_owner boolean;
begin
  v_owner := exists (select 1 from public.vaults where id = p_vault_id and user_id = auth.uid());

  select jsonb_build_object(
    'id', v0.id,
    'isOwner', v_owner,
    'name', case when v_owner then v0.name else null end,
    'protection', v0.protection,
    'hasBiometric', (v_owner and s.biometric is not null),
    'biometric', case when v_owner then s.biometric else null end,
    'failedAttempts', v0.failed_attempts, 'lockedUntil', v0.locked_until,
    'kdfIterations', s.kdf_iterations,
    'passwordSalt', s.password_salt, 'recoverySalt', s.recovery_salt)
  into v
  from public.vaults v0 join public.vault_secrets s on s.vault_id = v0.id
  where v0.id = p_vault_id;

  return v;
end;
$$;

create or replace function public.vault_open(p_vault_id uuid, p_verifier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_wrap jsonb; v_locked integer; v_attempts integer; v_session jsonb;
begin
  if not exists (select 1 from public.vaults where id = p_vault_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

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

  v_session := public.vault_session_issue(p_vault_id);
  return jsonb_build_object('ok', true, 'wrap', v_wrap,
    'token', v_session->>'token', 'expiresAt', v_session->>'expiresAt');
end;
$$;

create or replace function public.vault_open_recovery(p_vault_id uuid, p_verifier text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_wrap jsonb; v_locked integer; v_session jsonb;
begin
  if not exists (select 1 from public.vaults where id = p_vault_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

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

  v_session := public.vault_session_issue(p_vault_id);
  return jsonb_build_object('ok', true, 'wrap', v_wrap,
    'token', v_session->>'token', 'expiresAt', v_session->>'expiresAt');
end;
$$;

-- « Mot de passe oublié ? » depuis le QR Code : le code de récupération tient
-- lieu de preuve, exactement comme le mot de passe. Aucun compte n'est requis.
create or replace function public.vault_reset_password(
  p_vault_id uuid, p_recovery_verifier text,
  p_password_salt text, p_password_verifier text, p_password_wrap jsonb,
  p_new_recovery_salt text, p_new_recovery_verifier text, p_new_recovery_wrap jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_locked integer; v_session jsonb;
begin
  if not exists (select 1 from public.vaults where id = p_vault_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

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

  v_session := public.vault_session_issue(p_vault_id);
  return jsonb_build_object('ok', true,
    'token', v_session->>'token', 'expiresAt', v_session->>'expiresAt');
end;
$$;

-- ------------------------------------------------------------------ droits
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut : on retire tout, puis on
-- rouvre précisément. Seules les fonctions ci-dessous sont ouvertes à anon,
-- et chacune exige sa propre preuve (vérificateur ou jeton de session).

revoke all on function public.vault_session_issue(uuid)       from public, anon, authenticated;
revoke all on function public.vault_session_vault(text)       from public, anon, authenticated;
revoke all on function public.vault_session_close(text)       from public, anon, authenticated;
revoke all on function public.vault_session_content(text)     from public, anon, authenticated;
revoke all on function public.vault_session_file(text, uuid)  from public, anon, authenticated;
revoke all on function public.vault_intro(uuid)               from public, anon, authenticated;
revoke all on function public.vault_open(uuid, text)          from public, anon, authenticated;
revoke all on function public.vault_open_recovery(uuid, text) from public, anon, authenticated;
revoke all on function public.vault_reset_password(uuid, text, text, text, jsonb, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.vault_intro(uuid)               to anon, authenticated;
grant execute on function public.vault_open(uuid, text)          to anon, authenticated;
grant execute on function public.vault_open_recovery(uuid, text) to anon, authenticated;
grant execute on function public.vault_session_content(text)     to anon, authenticated;
grant execute on function public.vault_session_file(text, uuid)  to anon, authenticated;
grant execute on function public.vault_session_close(text)       to anon, authenticated;
grant execute on function public.vault_reset_password(uuid, text, text, text, jsonb, text, text, jsonb)
  to anon, authenticated;

-- vault_session_issue et vault_session_vault restent hors de portée du client :
-- fabriquer un jeton sans mot de passe donnerait accès aux fichiers.
