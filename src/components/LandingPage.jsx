import React, { useEffect } from "react";
import { useLegal } from "../contexts/LegalContext";
import { useInstallPrompt } from "../lib/pwa";
import { useLandingTheme } from "./landing/theme";
import { Section } from "./landing/ui";
import {
  Assistant, CommentCaMarche, CtaFinale, Equipe, Essai, Faq, Fonctionnalites,
  Hero, Probleme, Produit, Securite, Stock, TableauDeBord, Tarifs,
} from "./landing/sections";

/**
 * Page d'accueil publique de Margitrack.
 *
 * Elle ne fait pas partie de l'application installée : celle-ci démarre sur
 * /app, à l'écran de connexion. Cette page s'adresse au visiteur qui découvre
 * Margitrack, et n'a donc aucune préférence enregistrée — elle choisit son
 * thème toute seule, à partir de celui de son téléphone.
 */

const FAQ = [
  { q: "Ai-je besoin d'un matériel spécial ?", a: "Non. Margitrack fonctionne directement dans le navigateur de votre téléphone ou ordinateur — aucune caisse enregistreuse ni imprimante n'est nécessaire. L'application peut aussi s'installer sur l'écran d'accueil de votre téléphone." },
  { q: "Comment fonctionne l'essai gratuit ?", a: "Dès votre inscription, vous avez accès à toutes les fonctionnalités de Margitrack pendant 30 jours, sans engagement et sans carte bancaire." },
  { q: "Que se passe-t-il après l'essai gratuit ?", a: "Si vous ne passez pas à l'abonnement Pro, l'accès aux fonctionnalités est suspendu jusqu'à votre passage à Pro — vos données restent en sécurité et ne sont jamais supprimées." },
  { q: "Mes données sont-elles partagées avec d'autres restaurants ?", a: "Non, jamais. Chaque restaurant a un espace totalement isolé — personne d'autre ne peut voir vos ventes, dépenses ou produits." },
  { q: "Puis-je ajouter plusieurs membres de mon équipe ?", a: "Oui. Vous pouvez inviter des gérants, secrétaires, caissiers et responsables de stock, chacun avec des permissions adaptées à son rôle. Les employés qui n'ont pas besoin d'un accès restent simplement enregistrés dans la fiche d'équipe." },
  { q: "Margitrack fonctionne-t-il sans connexion ?", a: "L'application s'ouvre même sans réseau une fois installée. L'enregistrement des ventes et des dépenses, lui, a besoin d'une connexion pour que toute votre équipe voie les mêmes chiffres." },
  { q: "Comment se fait le paiement de l'abonnement ?", a: "Le paiement se fait de manière sécurisée via Chariow, une plateforme de paiement adaptée à l'Afrique." },
];

/**
 * Adresse de contact affichée dans le pied de page.
 *
 * Laissée vide volontairement : publier une adresse revient à l'exposer aux
 * robots de collecte, et ce choix appartient au propriétaire. Renseignez
 * l'adresse ici et le lien « Contact » apparaît aussitôt.
 */
const CONTACT_EMAIL = "";

function ThemeToggle({ c, name, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={name === "light" ? "Passer en thème sombre" : "Passer en thème clair"}
      className="rounded-full flex items-center justify-center transition-colors"
      style={{ width: 36, height: 36, backgroundColor: c.elevated, color: c.muted }}
    >
      {name === "light" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.4 13.6A8.6 8.6 0 0 1 10.4 3.6a8.6 8.6 0 1 0 10 10Z" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.6 5.6 4 4M20 20l-1.6-1.6M18.4 5.6 20 4M4 20l1.6-1.6" />
        </svg>
      )}
    </button>
  );
}

export function LandingPage({ onStart, onLogin }) {
  const { openPrivacy, openTerms } = useLegal();
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const { name: theme, colors: c, toggle } = useLandingTheme();

  // Les liens d'ancre du menu glissent au lieu de sauter.
  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = previous; };
  }, []);

  // « Commencer gratuitement » mène à la création de compte, rien d'autre :
  // s'interposer avec un écran d'installation retardait la seule chose que
  // le visiteur était venu faire.
  const handleStart = onStart;

  // Installation en un geste, par la proposition du navigateur lui-même.
  // Quand celui-ci n'en émet pas — iPhone, ou application déjà installée sur
  // l'appareil — le bouton disparaît plutôt que d'ouvrir un écran
  // d'explications que personne ne lit.
  const install = (
    <>
      {canInstall && (
        <button
          onClick={promptInstall}
          className="mt-6 inline-flex items-center gap-2 rounded-full text-sm font-semibold px-5 py-2.5 border"
          style={{ borderColor: `${c.violet}66`, color: c.ink, backgroundColor: c.card }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3.6v11" /><path d="m7.6 10.2 4.4 4.4 4.4-4.4" /><path d="M4.4 19.6h15.2" />
          </svg>
          Installer l'application sur mon téléphone
        </button>
      )}
      {installed && (
        <p className="text-xs mt-6" style={{ color: c.muted }}>
          Margitrack est déjà installé sur cet appareil — ouvrez-le depuis votre écran d'accueil.
        </p>
      )}
    </>
  );

  const navLinks = [
    { href: "#fonctionnalites", label: "Fonctionnalités" },
    { href: "#tarifs", label: "Tarifs" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: c.bg }}>
      {/* Lueur violette derrière le haut de page : elle donne la profondeur
          d'une vraie page produit sans alourdir le chargement d'une image. */}
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
          style={{
            background: `radial-gradient(60% 60% at 50% 0%, ${c.glow}, transparent 70%)`,
          }}
          aria-hidden="true"
        />

        <header
          className="sticky top-0 z-30 backdrop-blur"
          style={{
            backgroundColor: c.name === "light" ? "rgba(246,247,251,0.85)" : "rgba(11,13,23,0.85)",
            borderBottom: `1px solid ${c.line}`,
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-6 py-3">
            <a href="#top" className="flex items-center gap-2 shrink-0">
              <img src="/logo.svg" alt="Margitrack" className="w-8 h-8 rounded-lg" />
              <span className="font-semibold font-display" style={{ color: c.ink }}>Margitrack</span>
            </a>

            <nav className="hidden md:flex items-center gap-7 text-sm">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} style={{ color: c.muted }} className="hover:opacity-80">
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle c={c} name={c.name} onToggle={toggle} />
              <button
                onClick={onLogin}
                className="text-sm font-medium px-2 py-2"
                style={{ color: c.muted }}
              >
                Se connecter
              </button>
              <button
                onClick={handleStart}
                className="rounded-full text-sm font-semibold text-white px-4 py-2 whitespace-nowrap"
                style={{ background: `linear-gradient(135deg, ${c.violet}, ${c.violetDeep})` }}
              >
                Commencer<span className="hidden sm:inline"> gratuitement</span>
              </button>
            </div>
          </div>
        </header>

        <div id="top" />
        <Hero c={c} theme={theme} onStart={handleStart} install={install} />
      </div>

      <Section className="py-6">
        <div
          className="rounded-3xl px-6 py-5 text-center"
          style={{ backgroundColor: c.card, border: `1px solid ${c.line}` }}
        >
          <p className="text-[15px]" style={{ color: c.muted }}>
            Margitrack s'adresse aux{" "}
            <strong style={{ color: c.ink }}>restaurants, maquis, snack-bars et petites chaînes</strong>{" "}
            qui veulent enfin savoir, chaque jour, combien ils vendent, combien
            ils dépensent — et combien il leur reste vraiment.
          </p>
        </div>
      </Section>

      <Probleme c={c} />
      <Produit c={c} theme={theme} />
      <Fonctionnalites c={c} />
      <Stock c={c} theme={theme} />
      <Equipe c={c} />
      <Assistant c={c} theme={theme} />
      <TableauDeBord c={c} theme={theme} />
      <CommentCaMarche c={c} />
      <Essai c={c} onStart={handleStart} />
      <Tarifs c={c} onStart={handleStart} />
      <Faq c={c} items={FAQ} />
      <Securite c={c} />
      <CtaFinale c={c} onStart={handleStart} />

      <footer style={{ borderTop: `1px solid ${c.line}`, backgroundColor: c.band }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo.svg" alt="" className="w-7 h-7 rounded-lg" />
                <span className="font-semibold font-display" style={{ color: c.ink }}>Margitrack</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: c.muted }}>
                La gestion de restaurant, pensée pour l'Afrique : ventes,
                dépenses, stock et équipe au même endroit.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: c.ink }}>Produit</p>
              <ul className="space-y-2 text-sm" style={{ color: c.muted }}>
                {navLinks.map((l) => (
                  <li key={l.href}><a href={l.href} className="hover:opacity-80">{l.label}</a></li>
                ))}
                <li><a href="#produit" className="hover:opacity-80">L'application</a></li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: c.ink }}>Votre compte</p>
              <ul className="space-y-2 text-sm" style={{ color: c.muted }}>
                <li><button onClick={handleStart} className="hover:opacity-80">Créer un compte</button></li>
                <li><button onClick={onLogin} className="hover:opacity-80">Se connecter</button></li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: c.ink }}>Informations</p>
              <ul className="space-y-2 text-sm" style={{ color: c.muted }}>
                <li><button onClick={openPrivacy} className="hover:opacity-80 text-left">Politique de confidentialité</button></li>
                <li><button onClick={openTerms} className="hover:opacity-80 text-left">Conditions d'utilisation</button></li>
                {CONTACT_EMAIL && (
                  <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:opacity-80">Contact</a></li>
                )}
              </ul>
            </div>
          </div>

          <div
            className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderTop: `1px solid ${c.line}` }}
          >
            <p className="text-xs" style={{ color: c.muted }}>
              © {new Date().getFullYear()} Margitrack. Tous droits réservés.
            </p>
            <p className="text-xs" style={{ color: c.muted }}>
              Paiements sécurisés par Chariow · Montants en FCFA
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
