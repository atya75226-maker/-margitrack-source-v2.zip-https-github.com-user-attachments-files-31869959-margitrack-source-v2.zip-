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

export function PrivacyPolicy() {
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display mb-2">Politique de confidentialité</h1>
        <p className="text-xs text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}</p>

        <Block title="1. Ce que couvre ce document">
          <p>
            Cette politique décrit précisément quelles données Margitrack collecte, où elles sont hébergées, et avec
            qui elles sont partagées lorsque vous utilisez l'application — que ce soit en tant que propriétaire
            de restaurant ou membre d'une équipe (gérant, secrétaire, serveur).
          </p>
        </Block>

        <Block title="2. Données de compte">
          <p>Lors de la création d'un compte, nous conservons :</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Votre nom complet et votre adresse email ;</li>
            <li>Le nom de votre restaurant ;</li>
            <li>Votre rôle au sein du restaurant (propriétaire, gérant, secrétaire ou serveur) ;</li>
            <li>Un numéro de téléphone, uniquement s'il est renseigné (par exemple lors de l'ajout d'un membre d'équipe).</li>
          </ul>
        </Block>

        <Block title="3. Connexion avec Google">
          <p>
            Si vous choisissez de vous connecter avec Google, nous recevons de Google votre nom et votre adresse
            email associés à votre compte Google, afin de créer ou reconnaître votre compte Margitrack. Nous ne
            recevons jamais votre mot de passe Google.
          </p>
        </Block>

        <Block title="4. Données de gestion de votre restaurant">
          <p>
            Dans le cadre normal de l'utilisation de Margitrack, vous enregistrez vous-même : vos produits et leurs
            prix, vos ventes (produit, quantité, date), vos dépenses (catégorie, montant, date, description
            facultative), ainsi que les membres de votre équipe. Ces données vous appartiennent et servent
            uniquement à faire fonctionner votre tableau de bord.
          </p>
        </Block>

        <Block title="5. Isolation entre restaurants">
          <p>
            Chaque restaurant dispose d'un espace de données strictement isolé au niveau de la base de données
            (règles de sécurité au niveau des lignes). Concrètement, un restaurant ne peut techniquement pas
            accéder aux données d'un autre restaurant, quelle que soit la manière dont il utilise l'application.
          </p>
        </Block>

        <Block title="6. Hébergement">
          <p>
            Vos données sont hébergées par Supabase (base de données PostgreSQL, authentification et fonctions
            serveur), un prestataire d'infrastructure tiers spécialisé. Margitrack ne stocke aucune donnée sur des
            serveurs personnels distincts.
          </p>
        </Block>

        <Block title="7. Assistant IA">
          <p>
            Lorsque vous posez une question à l'Assistant Margitrack ou générez un rapport, les données nécessaires
            pour y répondre (par exemple vos ventes, dépenses et produits des 30 derniers jours) sont transmises
            à un service d'intelligence artificielle tiers (Google Gemini) le temps de générer la réponse. Ces
            données ne sont utilisées que pour produire la réponse demandée.
          </p>
        </Block>

        <Block title="8. Paiement de l'abonnement">
          <p>
            Le paiement de l'abonnement Pro est traité directement par Chariow, notre prestataire de paiement.
            Margitrack ne voit et ne stocke jamais vos informations de carte bancaire ou de paiement mobile —
            Chariow nous transmet uniquement la confirmation qu'un paiement a été effectué, avec l'email utilisé,
            afin d'activer votre abonnement.
          </p>
        </Block>

        <Block title="9. Cookies et stockage local">
          <p>
            Margitrack utilise le stockage local de votre navigateur uniquement pour garder votre session de
            connexion active, afin de ne pas avoir à vous reconnecter à chaque visite. Nous n'utilisons aucun
            cookie publicitaire ni outil de suivi à des fins de publicité.
          </p>
        </Block>

        <Block title="10. Durée de conservation">
          <p>
            Vos données sont conservées tant que votre compte est actif. Si votre essai gratuit ou votre
            abonnement expire sans renouvellement, l'accès à l'application est suspendu, mais vos données ne
            sont pas supprimées — elles redeviennent accessibles dès que l'abonnement est repris.
          </p>
        </Block>

        <Block title="11. Vos droits">
          <p>
            Vous pouvez demander l'accès, la correction ou la suppression de vos données personnelles à tout
            moment en nous contactant à l'adresse indiquée ci-dessous. Les demandes de suppression sont traitées
            manuellement par notre équipe.
          </p>
        </Block>

        <Block title="12. Contact">
          <p>Pour toute question concernant vos données, contactez-nous à : contact@margitrack.app</p>
        </Block>

        <Block title="13. Modifications">
          <p>
            Cette politique peut être mise à jour pour refléter des évolutions de l'application. La date de
            dernière mise à jour figure en haut de cette page.
          </p>
        </Block>
      </main>
    </div>
  );
}
