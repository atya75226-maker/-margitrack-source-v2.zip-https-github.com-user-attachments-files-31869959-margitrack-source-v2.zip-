/**
 * URL signée d'un fichier de coffre, sur présentation d'un jeton de session.
 *
 * Pourquoi cette fonction existe : le bucket « vault-files » est privé, et ses
 * règles d'accès ne reconnaissent que le propriétaire connecté. Une personne qui
 * scanne le QR Code n'a pas de compte — elle a seulement prouvé qu'elle
 * connaissait le mot de passe du coffre, ce qui lui a valu un jeton de session.
 * Le navigateur ne peut donc pas fabriquer l'URL signée lui-même : il la demande
 * ici, et c'est le serveur qui vérifie le jeton avant de la produire.
 *
 * Ce qui reste vrai après ce détour :
 *  - le bucket n'est jamais public ;
 *  - l'URL délivrée expire au bout d'une minute ;
 *  - le fichier téléchargé est chiffré ; seule la clé du coffre, dérivée du mot
 *    de passe dans le navigateur, permet de le lire. Cette fonction ne la voit
 *    jamais.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const DUREE_URL_SECONDES = 60
const BUCKET = 'vault-files'

const enTetes = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), { status, headers: enTetes })
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: enTetes })
  if (requete.method !== 'POST') return reponse({ ok: false, error: 'method' }, 405)

  let corps: { token?: string; fileId?: string }
  try {
    corps = await requete.json()
  } catch {
    return reponse({ ok: false, error: 'body' }, 400)
  }

  const { token, fileId } = corps
  if (!token || !fileId) return reponse({ ok: false, error: 'missing' }, 400)

  // La clé de service ne sert qu'à deux choses : vérifier le jeton et signer
  // l'URL. Elle ne quitte jamais cette fonction.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: fichier, error } = await supabase.rpc('vault_session_file', {
    p_token: token,
    p_file_id: fileId,
  })

  if (error) return reponse({ ok: false, error: 'lookup' }, 500)
  if (!fichier?.ok) return reponse({ ok: false, error: fichier?.error || 'denied' }, 403)

  const { data: signee, error: erreurSignature } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fichier.path, DUREE_URL_SECONDES)

  if (erreurSignature || !signee?.signedUrl) return reponse({ ok: false, error: 'sign' }, 500)

  return reponse({
    ok: true,
    url: signee.signedUrl,
    iv: fichier.iv,
    mime: fichier.mime,
    name: fichier.name,
    expiresIn: DUREE_URL_SECONDES,
  })
})
