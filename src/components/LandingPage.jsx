import React from "react";
import { COLOR } from "../lib/theme";
import { useLegal } from "../contexts/LegalContext";
import { useInstallPrompt } from "../lib/pwa";

const FEATURES = [
  { icon: "📦", title: "Produits", text: "Ajoutez vos produits et leurs prix en quelques secondes, sans matériel spécial." },
  { icon: "🧾", title: "Ventes", text: "Enregistrez chaque vente du jour, par produit et par quantité, en un clic." },
  { icon: "💸", title: "Dépenses", text: "Suivez achats, loyer, électricité et toutes vos charges par catégorie." },
  { icon: "📈", title: "Chiffre d'affaires & bénéfices", text: "Un tableau de bord clair : ventes, dépenses et bénéfice réel, mis à jour en temps réel." },
  { icon: "👥", title: "Gestion d'équipe", text: "Ajoutez gérants, secrétaires et serveurs avec des droits d'accès adaptés à chacun." },
  { icon: "✨", title: "Assistant IA", text: "Posez vos questions en langage naturel : \"Quel est mon produit le plus rentable ?\" — la réponse s'appuie sur vos vraies données." },
];

const AVANTAGES = [
  { title: "Pensé pour l'Afrique", text: "Montants en FCFA, moyens de paiement locaux (Chariow), pas besoin de matériel de caisse coûteux." },
  { title: "100% mobile", text: "Gérez votre restaurant depuis votre téléphone — au comptoir, en cuisine, ou en déplacement." },
  { title: "Temps réel", text: "Chaque vente, dépense ou ajout d'équipe se reflète instantanément pour toute l'équipe." },
  { title: "Aucune formation nécessaire", text: "Une interface simple, en français, pensée pour être utilisée dès la première minute." },
];

const FAQ = [
  { q: "Ai-je besoin d'un matériel spécial ?", a: "Non. Margitrack fonctionne directement dans le navigateur de votre téléphone ou ordinateur — aucune caisse enregistreuse ni imprimante n'est nécessaire." },
  { q: "Comment fonctionne l'essai gratuit ?", a: "Dès votre inscription, vous avez accès à toutes les fonctionnalités de Margitrack pendant 30 jours, sans engagement et sans carte bancaire." },
  { q: "Que se passe-t-il après l'essai gratuit ?", a: "Si vous ne passez pas à l'abonnement Pro, l'accès aux fonctionnalités est suspendu jusqu'à votre passage à Pro — vos données restent en sécurité et ne sont jamais supprimées." },
  { q: "Mes données sont-elles partagées avec d'autres restaurants ?", a: "Non, jamais. Chaque restaurant a un espace totalement isolé — personne d'autre ne peut voir vos ventes, dépenses ou produits." },
  { q: "Puis-je ajouter plusieurs membres de mon équipe ?", a: "Oui. Vous pouvez inviter des gérants, secrétaires et serveurs, chacun avec des permissions adaptées à son rôle." },
  { q: "Comment se fait le paiement de l'abonnement ?", a: "Le paiement se fait de manière sécurisée via Chariow, une plateforme de paiement adaptée à l'Afrique." },
];

function Section({ id, children, className = "" }) {
  return (
    <section id={id} className={`px-5 py-14 max-w-5xl mx-auto ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center mb-10">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLOR.violet }}>{eyebrow}</p>}
      <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">{title}</h2>
      {subtitle && <p className="text-sm sm:text-base text-gray-400 mt-3 max-w-2xl mx-auto">{subtitle}</p>}
    </div>
  );
}

export function LandingPage({ onStart, onLogin }) {
  const { openPrivacy, openTerms } = useLegal();
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  // « Commencer gratuitement » mène à la création de compte, rien d'autre :
  // s'interposer avec un écran d'installation retardait la seule chose que
  // le visiteur était venu faire.
  const handleStart = onStart;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLOR.bg }}>
      <header className="sticky top-0 z-20 backdrop-blur bg-[#0B0D17]/90 border-b border-[#1B1F2E]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Margitrack" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-white font-display">Margitrack</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-400">
            <a href="#fonctionnalites" className="hover:text-white">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-white">Tarifs</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={onLogin} className="text-sm font-medium text-gray-300 hover:text-white">Se connecter</button>
            <button onClick={handleStart} className="rounded-full text-sm font-semibold text-white px-4 py-2" style={{ backgroundColor: COLOR.violet }}>
              Commencer gratuitement
            </button>
          </div>
        </div>
      </header>

      <Section className="pt-16 pb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: COLOR.violet }}>
          Le logiciel de gestion pensé pour les restaurants africains
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold text-white font-display leading-tight">
          Gérez votre restaurant,<br className="hidden sm:block" /> sans tableur ni papier
        </h1>
        <p className="text-gray-400 mt-5 max-w-xl mx-auto text-base sm:text-lg">
          Produits, ventes, dépenses, équipe et bénéfices — tout au même endroit, sur votre téléphone,
          avec un Assistant IA qui répond à vos questions sur votre propre activité.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <button onClick={handleStart} className="w-full sm:w-auto rounded-full text-base font-semibold text-white px-8 py-3.5" style={{ backgroundColor: COLOR.violet }}>
            Commencer gratuitement
          </button>
          <a href="#fonctionnalites" className="w-full sm:w-auto rounded-full text-base font-semibold px-8 py-3.5 border text-center" style={{ borderColor: COLOR.line, color: COLOR.ink }}>
            Découvrir les fonctionnalités
          </a>
        </div>
        <p className="text-xs text-gray-500 mt-4">30 jours d'essai gratuit — sans carte bancaire, sans engagement.</p>

        {/* Installation en un geste, par la proposition du navigateur
            lui-même. Quand celui-ci n'en émet pas — iPhone, ou application
            déjà installée sur l'appareil — le bouton disparaît plutôt que
            d'ouvrir un écran d'explications que personne ne lit. */}
        {canInstall && (
          <div className="mt-6 inline-flex flex-col items-center gap-2">
            <button
              onClick={promptInstall}
              className="rounded-full text-sm font-semibold px-6 py-3 border"
              style={{ borderColor: COLOR.violet, color: COLOR.ink }}
            >
              Installer Margitrack sur mon téléphone
            </button>
            <span className="text-xs text-gray-500">
              L'application s'ouvre ensuite directement sur votre espace, sans passer par cette page.
            </span>
          </div>
        )}

        {installed && (
          <p className="text-xs text-gray-500 mt-6">
            Margitrack est déjà installé sur cet appareil — ouvrez-le depuis votre écran d'accueil.
          </p>
        )}
      </Section>

      <Section className="py-8">
        <div className="rounded-3xl p-6 sm:p-8 text-center" style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.line}` }}>
          <p className="text-sm sm:text-base text-gray-300">
            Margitrack s'adresse aux <strong className="text-white">restaurants, maquis, snack-bars et petites chaînes</strong> qui
            veulent enfin savoir, chaque jour, combien ils vendent, combien ils dépensent — et combien il leur reste vraiment.
          </p>
        </div>
      </Section>

      <Section id="fonctionnalites">
        <SectionTitle eyebrow="Fonctionnalités" title="Tout ce qu'il faut pour piloter votre activité" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl p-5" style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.line}` }}>
              <div className="text-2xl mb-3">{f.icon}</div>
              <p className="font-semibold text-white mb-1">{f.title}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="py-8">
        <SectionTitle eyebrow="Avantages" title="Pourquoi choisir Margitrack" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AVANTAGES.map((a) => (
            <div key={a.title} className="rounded-2xl p-5 flex gap-3" style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.line}` }}>
              <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: COLOR.violet }} />
              <div>
                <p className="font-semibold text-white mb-1">{a.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{a.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section className="py-8">
        <div className="rounded-3xl p-6 sm:p-8" style={{ backgroundColor: COLOR.violetSoft, border: `1px solid ${COLOR.violet}40` }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: COLOR.violet }}>Essai gratuit</p>
          <h3 className="text-xl sm:text-2xl font-bold text-white font-display mb-2">30 jours pour tout tester, sans risque</h3>
          <p className="text-sm sm:text-base text-gray-300 max-w-2xl">
            Créez votre compte et accédez immédiatement à toutes les fonctionnalités de Margitrack pendant 30 jours —
            sans carte bancaire. À la fin de l'essai, passez à l'abonnement Pro pour continuer ; vos données, elles,
            ne sont jamais supprimées.
          </p>
        </div>
      </Section>

      <Section id="tarifs" className="py-8">
        <SectionTitle eyebrow="Tarifs" title="Un tarif simple, pensé pour les petits restaurants" />
        <div className="max-w-sm mx-auto rounded-3xl p-6 sm:p-8" style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.violet}` }}>
          <p className="font-semibold text-white text-lg">Margitrack Pro</p>
          <p className="mt-2">
            <span className="text-3xl sm:text-4xl font-bold text-white font-display">5 000 FCFA</span>
            <span className="text-gray-400"> / mois</span>
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-gray-300">
            {[
              "Produits, ventes et dépenses illimités",
              "Tableau de bord chiffre d'affaires & bénéfices",
              "Gestion d'équipe (gérants, secrétaires, serveurs)",
              "Assistant IA illimité",
              "Reçus de performance partageables",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span style={{ color: COLOR.success }}>✓</span> {item}
              </li>
            ))}
          </ul>
          <button onClick={handleStart} className="w-full rounded-full text-sm font-semibold text-white py-3 mt-6" style={{ backgroundColor: COLOR.violet }}>
            Commencer gratuitement
          </button>
        </div>
      </Section>

      <Section id="faq" className="py-8">
        <SectionTitle eyebrow="FAQ" title="Questions fréquentes" />
        <div className="space-y-3 max-w-2xl mx-auto">
          {FAQ.map((item) => (
            <details key={item.q} className="rounded-2xl p-4" style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.line}` }}>
              <summary className="font-medium text-white cursor-pointer text-sm sm:text-base">{item.q}</summary>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section className="py-8">
        <div className="rounded-3xl p-6 sm:p-8 text-center" style={{ backgroundColor: COLOR.card, border: `1px solid ${COLOR.line}` }}>
          <p className="text-2xl mb-2">🔒</p>
          <h3 className="text-lg sm:text-xl font-bold text-white font-display mb-2">Vos données sont en sécurité</h3>
          <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto">
            Chaque restaurant dispose d'un espace totalement isolé — vos ventes, vos dépenses et vos données d'équipe
            ne sont jamais accessibles par un autre restaurant. Les paiements sont traités de manière sécurisée par Chariow.
          </p>
        </div>
      </Section>

      <Section className="py-14 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white font-display mb-4">Prêt à savoir ce que gagne vraiment votre restaurant ?</h2>
        <button onClick={handleStart} className="rounded-full text-base font-semibold text-white px-8 py-3.5" style={{ backgroundColor: COLOR.violet }}>
          Commencer gratuitement
        </button>
      </Section>

      <footer className="border-t border-[#1B1F2E] py-8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Margitrack" className="w-6 h-6 rounded-md" />
            <span className="text-sm font-semibold text-white">Margitrack</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <button onClick={openPrivacy} className="hover:text-white">Politique de confidentialité</button>
            <button onClick={openTerms} className="hover:text-white">Conditions d'utilisation</button>
          </div>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Margitrack. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
