/**
 * Confirmation de paiement Chariow (« Pulse ») → abonnement Pro.
 *
 * C'est le seul chemin par lequel un compte devient Pro. Ni un clic, ni un
 * retour de page, ni un paramètre d'URL ne l'accordent : tout cela est sous le
 * contrôle du navigateur, donc sans valeur comme preuve de paiement.
 *
 * Ce que fait cette fonction, dans l'ordre :
 *  1. vérifie la signature HMAC du corps reçu avec le secret du Pulse. Sans
 *     cette vérification, n'importe qui pourrait s'offrir un abonnement en
 *     appelant cette adresse ;
 *  2. rattache le paiement à un compte par l'adresse e-mail — Chariow la
 *     collecte toujours sur sa page de paiement ;
 *  3. appelle activate_pro(), qui prolonge l'échéance, journalise l'évènement
 *     et refuse de traiter deux fois le même paiement.
 *
 * À configurer une fois dans Chariow (Automations → Pulses) :
 *  - URL : https://<projet>.supabase.co/functions/v1/chariow-webhook
 *  - évènements : successful_sale, license_expired, license_revoked
 *  - le secret affiché (whsec_…) doit être copié dans le secret Supabase
 *    CHARIOW_PULSE_SECRET.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const JOURS_PAR_PAIEMENT = 30

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

/** Signature Chariow : « sha256=… », HMAC-SHA256 du corps brut. */
async function signatureValide(corps: string, recue: string | null, secret: string) {
  if (!recue) return false
  const cle = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signe = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(corps))
  const hex = Array.from(new Uint8Array(signe)).map((o) => o.toString(16).padStart(2, '0')).join('')
  const attendue = `sha256=${hex}`

  // Comparaison à durée constante : comparer avec === laisse fuir, par le temps
  // de réponse, le nombre de caractères devinés juste.
  if (attendue.length !== recue.length) return false
  let ecart = 0
  for (let i = 0; i < attendue.length; i += 1) ecart |= attendue.charCodeAt(i) ^ recue.charCodeAt(i)
  return ecart === 0
}

Deno.serve(async (requete) => {
  if (requete.method !== 'POST') return new Response('method', { status: 405 })

  const corps = await requete.text()
  const secret = Deno.env.get('CHARIOW_PULSE_SECRET')
  if (!secret) return new Response('CHARIOW_PULSE_SECRET manquant côté serveur', { status: 500 })

  if (!(await signatureValide(corps, requete.headers.get('x-chariow-signature'), secret))) {
    return new Response('Signature invalide', { status: 401 })
  }

  let charge: Record<string, unknown>
  try {
    charge = JSON.parse(corps)
  } catch {
    return new Response('corps illisible', { status: 400 })
  }

  const evenement = String(charge.event ?? '')
  const client = (charge.customer ?? {}) as Record<string, unknown>
  const vente = (charge.sale ?? {}) as Record<string, unknown>
  const email = String(client.email ?? vente.email ?? '')

  if (!email) {
    console.error('Évènement Chariow sans adresse e-mail', evenement)
    return new Response('ok', { status: 200 })
  }

  const supabase = admin()

  try {
    if (evenement === 'successful.sale' || evenement === 'successful_sale') {
      const montant = (vente.amount ?? {}) as Record<string, unknown>
      const { data, error } = await supabase.rpc('activate_pro', {
        p_email: email,
        p_days: JOURS_PAR_PAIEMENT,
        p_reference: String(vente.id ?? charge.id ?? crypto.randomUUID()),
        p_event: 'successful.sale',
        p_amount: Number(montant.value ?? 0) || null,
        p_currency: String(montant.currency ?? 'XOF'),
        p_payload: charge,
      })
      if (error) throw error
      // Un paiement d'une adresse sans compte n'est pas une erreur du
      // prestataire : on répond 200 pour qu'il cesse de réessayer, et on le
      // signale dans les journaux pour un rattachement à la main.
      if (!data?.ok) console.error('Paiement non rattaché', data)
    } else if (
      evenement === 'license.expired' || evenement === 'license_expired'
      || evenement === 'license.revoked' || evenement === 'license_revoked'
    ) {
      const { error } = await supabase.rpc('revoke_pro', {
        p_email: email,
        p_event: evenement.replace('_', '.'),
        p_payload: charge,
      })
      if (error) throw error
    }
  } catch (erreur) {
    console.error('Traitement du Pulse en échec', erreur)
    return new Response(JSON.stringify({ error: String(erreur) }), { status: 500 })
  }

  return new Response('ok', { status: 200 })
})
