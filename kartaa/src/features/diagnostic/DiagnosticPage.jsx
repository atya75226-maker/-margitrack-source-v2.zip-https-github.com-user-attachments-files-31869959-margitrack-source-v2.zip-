import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Panel } from '../../components/ui'
import { Icon, Logo } from '../../components/ui/Icons'
import { supabase, AUTH_STORAGE_KEY, readStoredSession } from '../../lib/supabaseClient'
import { STORAGE_KIND } from '../../lib/authStorage'
import { isInAppBrowser, isStandalone } from '../../lib/browserEnv'
import { etatPwa } from '../../lib/pwa'

/**
 * Page de diagnostic de la connexion, ouverte depuis /diagnostic.
 *
 * Elle existe parce qu'une déconnexion vécue sur un téléphone ne laisse aucune
 * trace exploitable ailleurs : côté serveur, on voit seulement des sessions qui
 * cessent d'être rafraîchies, sans savoir ce que le navigateur a refusé. Cette
 * page pose les questions une à une, sur l'appareil concerné.
 *
 * Le témoin de persistance est le plus parlant : il s'incrémente à chaque
 * chargement. S'il reste à 1 après un rafraîchissement, le navigateur n'écrit
 * rien — c'est là, et nulle part ailleurs, que la session se perd.
 */

const TEMOIN = 'kartaa.diagnostic.rechargements'

function Ligne({ label, valeur, etat }) {
  const couleurs = { ok: 'text-emerald-600', ko: 'text-rose-600', neutre: 'text-ink-600' }
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0">
      <span className="text-sm text-ink-500">{label}</span>
      <span className={`text-right text-sm font-semibold ${couleurs[etat] || couleurs.neutre}`}>{valeur}</span>
    </div>
  )
}

export default function DiagnosticPage() {
  const [rechargements, setRechargements] = useState(0)
  const [sessionServeur, setSessionServeur] = useState('en cours…')
  const [renouvellement, setRenouvellement] = useState('non testé')
  const [pwa, setPwa] = useState(null)

  // Ce que le navigateur a réellement en place pour l'installation. C'est cette
  // partie qui explique pourquoi un téléphone installe et pas un autre.
  useEffect(() => {
    let vivant = true
    etatPwa().then((etat) => vivant && setPwa(etat))
    return () => { vivant = false }
  }, [])

  // Témoin de persistance : écrit puis relu à chaque chargement de la page.
  useEffect(() => {
    let precedent = 0
    try {
      precedent = Number(window.localStorage.getItem(TEMOIN) || 0)
      window.localStorage.setItem(TEMOIN, String(precedent + 1))
    } catch {
      precedent = -1
    }
    setRechargements(precedent + 1)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setSessionServeur(`erreur : ${error.message}`)
      else setSessionServeur(data.session ? `ouverte (${data.session.user.email})` : 'aucune')
    })
  }, [])

  const testerRenouvellement = useCallback(async () => {
    setRenouvellement('en cours…')
    const { data, error } = await supabase.auth.refreshSession()
    if (error) setRenouvellement(`échec : ${error.message}`)
    else setRenouvellement(data.session ? 'réussi' : 'aucune session à renouveler')
  }, [])

  const rangee = readStoredSession()
  const expiration = rangee?.expires_at ? new Date(rangee.expires_at * 1000) : null
  const support = { local: 'localStorage', cookie: 'cookies (repli)', memoire: 'mémoire vive' }[STORAGE_KIND]

  const rapport = [
    `adresse : ${window.location.origin}`,
    `support : ${support}`,
    `chargements comptés : ${rechargements}`,
    `jetons rangés : ${rangee ? 'oui' : 'non'}`,
    `expiration : ${expiration ? expiration.toLocaleString('fr-FR') : '—'}`,
    `session serveur : ${sessionServeur}`,
    `renouvellement : ${renouvellement}`,
    `fenêtre intégrée : ${isInAppBrowser() ? 'oui' : 'non'}`,
    `installée : ${isStandalone() ? 'oui' : 'non'}`,
    `installation : ${pwa?.mode || '…'}`,
    `service worker : ${pwa?.serviceWorker ? 'enregistré' : 'absent'}${pwa?.serviceWorkerActif ? ', actif' : ''}`,
    `proposition reçue : ${pwa?.propositionRecue ? 'oui' : 'non'}`,
    `navigateur : ${navigator.userAgent}`,
  ].join('\n')

  return (
    <div className="min-h-screen bg-ink-50 px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex">
          <Logo size={30} />
        </Link>

        <Panel>
          <h1 className="font-display text-xl font-extrabold text-ink-900">Diagnostic de connexion</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
            Rechargez cette page deux ou trois fois : si le nombre de chargements ne monte pas, votre
            navigateur n'enregistre rien et aucune session ne peut y survivre.
          </p>

          <div className="mt-5">
            <Ligne
              label="Chargements comptés"
              valeur={rechargements > 0 ? rechargements : 'écriture refusée'}
              etat={rechargements > 1 ? 'ok' : rechargements === 1 ? 'neutre' : 'ko'}
            />
            <Ligne
              label="Où la session est rangée"
              valeur={support}
              etat={STORAGE_KIND === 'local' ? 'ok' : STORAGE_KIND === 'cookie' ? 'neutre' : 'ko'}
            />
            <Ligne label="Jetons présents sur l'appareil" valeur={rangee ? 'oui' : 'non'} etat={rangee ? 'ok' : 'ko'} />
            <Ligne
              label="Jeton d'accès valable jusqu'à"
              valeur={expiration ? expiration.toLocaleTimeString('fr-FR') : '—'}
            />
            <Ligne
              label="Session reconnue par le serveur"
              valeur={sessionServeur}
              etat={/ouverte/.test(sessionServeur) ? 'ok' : 'neutre'}
            />
            <Ligne
              label="Test de renouvellement"
              valeur={renouvellement}
              etat={renouvellement === 'réussi' ? 'ok' : /échec/.test(renouvellement) ? 'ko' : 'neutre'}
            />
            <Ligne
              label="Fenêtre d'une autre application"
              valeur={isInAppBrowser() ? 'oui' : 'non'}
              etat={isInAppBrowser() ? 'ko' : 'ok'}
            />
            <Ligne label="Application installée" valeur={isStandalone() ? 'oui' : 'non'} />
            <Ligne label="Adresse du site" valeur={window.location.hostname} />
            <Ligne label="Clé de session" valeur={AUTH_STORAGE_KEY} />
          </div>

          <div className="mt-6 border-t border-ink-100 pt-4">
            <p className="font-display text-sm font-bold text-ink-900">Installation de l'application</p>
            {pwa && (
              <div className="mt-2">
                <Ligne
                  label="Installation possible"
                  valeur={pwa.mode === 'native' ? 'oui, par bouton' : pwa.mode === 'installee' ? 'déjà installée' : 'par le menu'}
                  etat={pwa.mode === 'native' || pwa.mode === 'installee' ? 'ok' : 'neutre'}
                />
                <Ligne label="Service worker enregistré" valeur={pwa.serviceWorker ? 'oui' : 'non'} etat={pwa.serviceWorker ? 'ok' : 'ko'} />
                <Ligne label="Service worker actif" valeur={pwa.serviceWorkerActif ? 'oui' : 'non'} etat={pwa.serviceWorkerActif ? 'ok' : 'neutre'} />
                <Ligne label="Page contrôlée" valeur={pwa.controle ? 'oui' : 'pas encore'} etat={pwa.controle ? 'ok' : 'neutre'} />
                <Ligne label="Proposition reçue du navigateur" valeur={pwa.propositionRecue ? 'oui' : 'non'} etat={pwa.propositionRecue ? 'ok' : 'neutre'} />
                <Ligne label="HTTPS" valeur={pwa.https ? 'oui' : 'non'} etat={pwa.https ? 'ok' : 'ko'} />
                <Ligne label="Fenêtre d'une autre application" valeur={pwa.fenetreIntegree ? 'oui' : 'non'} etat={pwa.fenetreIntegree ? 'ko' : 'ok'} />
              </div>
            )}
            {pwa?.raison && (
              <p className="mt-2 rounded-2xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">{pwa.raison}</p>
            )}
          </div>

          <div className="mt-5 grid gap-2.5">
            <Button full variant="outline" icon="refresh" onClick={testerRenouvellement}>
              Tester le renouvellement du jeton
            </Button>
            <Button full variant="dark" icon="copy" onClick={() => navigator.clipboard?.writeText(rapport)}>
              Copier le rapport
            </Button>
          </div>

          {STORAGE_KIND !== 'local' && (
            <div className="mt-5 flex gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 p-3.5">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-gold-600" />
              <p className="text-xs leading-relaxed text-ink-600">
                Ce navigateur refuse le stockage local. Kartaa se replie sur les cookies
                {STORAGE_KIND === 'memoire'
                  && ', refusés eux aussi — la session ne survivra à aucun rechargement'}.
                Ouvrez le site dans Chrome ou Safari pour retrouver une session durable.
              </p>
            </div>
          )}

          <Link to="/app" className="mt-5 block text-center text-xs font-semibold text-ink-400 hover:text-ink-600">
            Retour à l'application
          </Link>
        </Panel>
      </div>
    </div>
  )
}
