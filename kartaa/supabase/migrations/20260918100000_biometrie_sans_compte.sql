-- Déverrouillage biométrique depuis la page du coffre, avec ou sans compte.
--
-- L'ouverture sans compte (migration du 14 septembre) a été traitée pour le mot
-- de passe et le code de récupération, mais pas pour la biométrie : vault_intro
-- cachait l'existence de l'empreinte à qui n'était pas le propriétaire connecté,
-- et vault_open_biometric exigeait toujours un compte propriétaire sans délivrer
-- de jeton de session. Résultat : sur la page qu'ouvre le QR Code, le bouton
-- n'apparaissait pas, et là où il apparaissait, aucun fichier n'était lisible
-- ensuite.
--
-- Ce que la biométrie prouve réellement : que CET appareil détient le secret
-- enrôlé. C'est une preuve de possession, indépendante du compte — la même
-- logique que le mot de passe du coffre. On l'aligne donc sur le même modèle :
--
--   le navigateur dérive un vérificateur à partir du secret donné par le
--   capteur ; le serveur n'en conserve que l'empreinte SHA-256 et ne livre
--   l'enveloppe chiffrée que si les deux correspondent.
--
-- Aucune donnée biométrique n'entre dans la base : ni empreinte, ni gabarit.
-- Le capteur reste géré par le système du téléphone, qui ne rend qu'une
-- signature.

alter table public.vault_secrets
  add column if not exists biometric_verifier bytea;

comment on column public.vault_secrets.biometric_verifier is
  'Empreinte SHA-256 du vérificateur dérivé du secret de l''appareil. Null pour les enrôlements antérieurs à cette migration, qui restent réservés au propriétaire connecté.';

-- --------------------------------------------------------------- vault_intro
-- Ce qui devient lisible avant authentification : l'identifiant de la clé
-- d'accès et les sels. Rien de tout cela n'ouvre le coffre — la norme WebAuthn
-- prévoit d'ailleurs que l'identifiant de clé soit transmis au navigateur avant
-- toute vérification, c'est lui qui permet au téléphone de savoir quelle
-- empreinte demander. Le nom du coffre et son contenu, eux, restent invisibles.
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
    'hasBiometric', (s.biometric is not null),
    'biometric', case when s.biometric is null then null else jsonb_build_object(
      'credentialId', s.biometric->>'credentialId',
      'prfSalt', s.biometric->>'prfSalt',
      'prfSupported', s.biometric->'prfSupported') end,
    'biometricSalt', s.biometric_wrap->>'salt',
    'biometricIterations', s.biometric_wrap->'iterations',
    'failedAttempts', v0.failed_attempts, 'lockedUntil', v0.locked_until,
    'kdfIterations', s.kdf_iterations,
    'passwordSalt', s.password_salt, 'recoverySalt', s.recovery_salt)
  into v
  from public.vaults v0 join public.vault_secrets s on s.vault_id = v0.id
  where v0.id = p_vault_id;

  return v;
end;
$$;

-- ------------------------------------------------------ vault_open_biometric
-- Même contrat que vault_open : tentatives comptées, verrou temporaire, jeton
-- de session à la réussite. La preuve change seulement de nature.
drop function if exists public.vault_open_biometric(uuid);

create or replace function public.vault_open_biometric(p_vault_id uuid, p_verifier text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_wrap jsonb; v_expected bytea; v_locked integer; v_attempts integer; v_session jsonb;
begin
  if not exists (select 1 from public.vaults where id = p_vault_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_locked := public.vault_locked_for(p_vault_id);
  if v_locked > 0 then
    return jsonb_build_object('ok', false, 'error', 'locked', 'retryInSeconds', v_locked);
  end if;

  select biometric_wrap, biometric_verifier into v_wrap, v_expected
  from public.vault_secrets where vault_id = p_vault_id;

  if v_wrap is null then
    return jsonb_build_object('ok', false, 'error', 'biometric_disabled');
  end if;

  if v_expected is not null then
    -- Enrôlement récent : la preuve vaut pour elle-même, sans compte.
    if p_verifier is null or extensions.digest(p_verifier, 'sha256') <> v_expected then
      v_attempts := public.vault_register_failure(p_vault_id, 'biometric');
      return jsonb_build_object('ok', false, 'error', 'biometric',
        'attemptsLeft', greatest(0, 5 - v_attempts),
        'retryInSeconds', public.vault_locked_for(p_vault_id));
    end if;
  elsif not exists (select 1 from public.vaults where id = p_vault_id and user_id = auth.uid()) then
    -- Enrôlement antérieur, sans vérificateur enregistré : on s'en tient à
    -- l'ancienne règle plutôt que d'ouvrir le coffre sans preuve.
    return jsonb_build_object('ok', false, 'error', 'biometric');
  end if;

  update public.vaults set failed_attempts = 0, locked_until = null, last_opened_at = now()
  where id = p_vault_id;
  insert into public.vault_access_log (vault_id, action, result, method)
  values (p_vault_id, 'vault.unlock', 'ok', 'biometric');

  v_session := public.vault_session_issue(p_vault_id);
  return jsonb_build_object('ok', true, 'wrap', v_wrap,
    'token', v_session->>'token', 'expiresAt', v_session->>'expiresAt');
end;
$$;

-- ------------------------------------------------------- vault_set_biometric
-- L'enrôlement enregistre désormais le vérificateur en même temps que
-- l'enveloppe : sans lui, le serveur n'aurait rien à quoi comparer.
drop function if exists public.vault_set_biometric(uuid, jsonb, jsonb);

create or replace function public.vault_set_biometric(
  p_vault_id uuid, p_biometric jsonb, p_wrap jsonb, p_verifier text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_vault_owner(p_vault_id);
  update public.vault_secrets
  set biometric = p_biometric,
      biometric_wrap = p_wrap,
      biometric_verifier = case
        when p_biometric is null or p_verifier is null then null
        else extensions.digest(p_verifier, 'sha256') end
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

-- ------------------------------------------------------------------ droits
revoke all on function public.vault_intro(uuid)                        from public, anon, authenticated;
revoke all on function public.vault_open_biometric(uuid, text)         from public, anon, authenticated;
revoke all on function public.vault_set_biometric(uuid, jsonb, jsonb, text) from public, anon, authenticated;

grant execute on function public.vault_intro(uuid)                     to anon, authenticated;
grant execute on function public.vault_open_biometric(uuid, text)      to anon, authenticated;
grant execute on function public.vault_set_biometric(uuid, jsonb, jsonb, text) to authenticated;
