import React from "react";
import { COLOR } from "../../lib/theme";
import { useLegal } from "../../contexts/LegalContext";

function Block({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-white font-display mb-3">{title}</h2>
      <div className="text-sm text-gray-400 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export function TermsOfService() {
  const { close } = useLegal();
  return (
    <div className="min-h-screen" style={{ backgroundColor: COLOR.bg }}>
      <header className="sticky top-0 z-20 bg-[#0B0D17]/90 backdrop-blur border-b border-[#1B1F2E]">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-5 py-3">
          <button onClick={close} className="text-sm font-medium" style={{ color: COLOR.violet }}>← Retour</button>
          <span className="font-semibold text-white font-display">Margitrack</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mb-2">Conditions d'utilisation</h1>
        <p className="text-xs text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</p>

        <Block title="1. Objet">
          <p>
            Ces conditions régissent l'utilisation de Margitrack, un logiciel de gestion destiné aux restaurants
            (produits, ventes, dépenses, équipe, tableau de bord et Assistant IA). En créant un compte, vous
            acceptez ces conditions.
          </p>
        </Block>

        <Block title="2. Comptes et rôles">
          <p>
            Le compte créé lors de l'inscription est un compte <strong className="text-gray-300">Propriétaire</strong>,
            avec accès complet à toutes les fonctionnalités. Le propriétaire peut ajouter des membres d'équipe
            avec un rôle de gérant, secrétaire ou serveur, chacun disposant d'un accès adapté à ce rôle. Le
            propriétaire est responsable des comptes qu'il crée au sein de son restaurant.
          </p>
        </Block>

        <Block title="3. Essai gratuit et abonnement">
          <p>
            À la création d'un compte, un essai gratuit de 30 jours donne accès à l'ensemble des fonctionnalités,
            sans carte bancaire requise. Passé ce délai, l'accès aux fonctionnalités de gestion est suspendu tant
            qu'un abonnement Margitrack Pro (5 000 FCFA / mois, payable via Chariow) n'a pas été souscrit avec
            l'email associé au compte Margitrack.
          </p>
        </Block>

        <Block title="4. Suspension pour non-paiement">
          <p>
            La suspension de l'accès après expiration de l'essai ou de l'abonnement n'entraîne aucune suppression
            de données. L'accès est automatiquement rétabli dès la confirmation du paiement.
          </p>
        </Block>

        <Block title="5. Utilisation autorisée">
          <p>Vous vous engagez à utiliser Margitrack uniquement pour la gestion légitime de votre restaurant, et notamment à ne pas :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tenter de contourner les mécanismes de sécurité ou d'isolation des données ;</li>
            <li>Accéder ou tenter d'accéder aux données d'un autre restaurant ;</li>
            <li>Utiliser l'application à des fins illégales.</li>
          </ul>
        </Block>

        <Block title="6. Propriété de vos données">
          <p>
            Les données que vous saisissez (produits, ventes, dépenses, équipe) vous appartiennent. Margitrack ne
            les utilise que pour faire fonctionner l'application pour votre compte, et ne les revend jamais.
          </p>
        </Block>

        <Block title="7. Assistant IA — limites">
          <p>
            L'Assistant Margitrack génère ses réponses et rapports automatiquement à partir de vos données, via un
            service d'intelligence artificielle tiers. Ces réponses sont fournies à titre indicatif pour vous
            aider à interpréter votre activité — elles ne remplacent pas l'avis d'un comptable ou d'un
            professionnel, et peuvent occasionnellement contenir des erreurs.
          </p>
        </Block>

        <Block title="8. Disponibilité du service">
          <p>
            Nous mettons en œuvre des moyens raisonnables pour assurer la disponibilité de Margitrack, sans pouvoir
            garantir un fonctionnement ininterrompu (maintenance, incidents techniques indépendants de notre
            volonté, notamment liés aux prestataires tiers utilisés — Supabase, Chariow, fournisseur d'IA).
          </p>
        </Block>

        <Block title="9. Responsabilité">
          <p>
            Margitrack est fourni en l'état. Dans la mesure permise par la loi applicable, nous ne pouvons être
            tenus responsables des pertes indirectes résultant de l'utilisation ou de l'impossibilité d'utiliser
            l'application, ou d'erreurs dans les données saisies par l'utilisateur lui-même.
          </p>
        </Block>

        <Block title="10. Résiliation">
          <p>
            Vous pouvez cesser d'utiliser Margitrack à tout moment. Nous nous réservons le droit de suspendre un
            compte en cas d'utilisation manifestement contraire à ces conditions.
          </p>
        </Block>

        <Block title="11. Modification des conditions">
          <p>
            Ces conditions peuvent évoluer avec l'application. La date de dernière mise à jour figure en haut de
            cette page ; la poursuite de l'utilisation de Margitrack après une modification vaut acceptation de la
            nouvelle version.
          </p>
        </Block>

        <Block title="12. Contact">
          <p>Pour toute question sur ces conditions, contactez-nous à : contact@margitrack.app</p>
        </Block>
      </main>
    </div>
  );
}
