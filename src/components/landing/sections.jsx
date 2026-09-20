import React from "react";
import {
  HomeIcon, SalesIcon, ExpensesIcon, StockIcon, ProductsIcon, AssistantIcon,
} from "../ui/Icons";
import { ACCESS_ROLES, DEFAULT_PERMISSIONS, PERMISSION_LABELS } from "../../hooks/usePermissions";
import { PHOTOS } from "./photos";
import {
  Card, Check, Eyebrow, GhostButton, Lead, Photo, PhoneFrame, PrimaryButton,
  Reveal, Screenshot, Section, SectionHead, Title, WindowFrame,
} from "./ui";

/* Quatre symboles manquaient au jeu de l'application : même grille de 24 px,
   même épaisseur de trait, pour que l'ensemble reste homogène. */
const Svg = ({ children }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IngredientIcon = () => (
  <Svg>
    <path d="M3.4 12.4h17.2a8.6 8.6 0 0 1-8.6 7.8 8.6 8.6 0 0 1-8.6-7.8Z" />
    <path d="M7.5 9.2c0-2 1.6-3.6 3.6-3.6" />
    <path d="M12 3.2v2.4" />
    <path d="M2.6 20.4h18.8" />
  </Svg>
);
const DrinkIcon = () => (
  <Svg>
    <path d="M9.4 2.8h5.2v2.6l1.6 2.4V20a1.2 1.2 0 0 1-1.2 1.2H9a1.2 1.2 0 0 1-1.2-1.2V7.8l1.6-2.4V2.8Z" />
    <path d="M7.8 12.2h8.4" />
  </Svg>
);
const TeamIcon = () => (
  <Svg>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.4 20.2a5.6 5.6 0 0 1 11.2 0" />
    <path d="M16.2 5.2a3.2 3.2 0 0 1 0 6.2" />
    <path d="M17.6 14.6a5.6 5.6 0 0 1 3 5.6" />
  </Svg>
);
const ReportIcon = () => (
  <Svg>
    <path d="M3.4 20.4h17.2" />
    <path d="M6.6 20.4v-6.2" />
    <path d="M11.4 20.4V7.6" />
    <path d="M16.2 20.4v-9.4" />
    <path d="m5.4 9.6 5-4.4 4.2 3 4.6-4.6" />
  </Svg>
);

const FEATURES = [
  { Icon: HomeIcon, title: "Tableau de bord", text: "Chiffre d'affaires, dépenses, bénéfice et marge du jour, de la semaine ou du mois." },
  { Icon: SalesIcon, title: "Ventes", text: "Enregistrez les ventes du service par produit et par quantité, en quelques appuis." },
  { Icon: ExpensesIcon, title: "Dépenses", text: "Loyer, électricité, salaires, transport : chaque charge classée par catégorie." },
  { Icon: StockIcon, title: "Gestion du stock", text: "Entrées, sorties, inventaire et valeur du stock, à l'unité près." },
  { Icon: IngredientIcon, title: "Ingrédients", text: "Riz, huile, poulet : suivis au kilo ou au litre, même achetés par sac ou bidon." },
  { Icon: DrinkIcon, title: "Boissons", text: "Achetées au casier, vendues à la bouteille — la conversion est faite pour vous." },
  { Icon: TeamIcon, title: "Employés", text: "Votre équipe, ses rôles et ses salaires, avec des accès adaptés à chacun." },
  { Icon: AssistantIcon, title: "Assistant intelligent", text: "Posez une question sur votre activité, la réponse part de vos propres chiffres." },
  { Icon: ReportIcon, title: "Rapports et analyses", text: "Évolution, produits les plus vendus, répartition des dépenses, reçus partageables." },
];

const PROBLEMES = [
  { icon: "📓", text: "Un cahier au comptoir, un autre en cuisine — et des pages qui manquent." },
  { icon: "🧮", text: "Des calculs refaits chaque soir, jamais deux fois pareils." },
  { icon: "🧾", text: "Des reçus d'achat qui s'entassent sans jamais être totalisés." },
  { icon: "📦", text: "Un stock qu'on découvre vide au moment de servir." },
  { icon: "❓", text: "Et la vraie question, sans réponse : qu'est-ce qui reste à la fin du mois ?" },
];

const ETAPES = [
  { n: "01", titre: "Créez votre compte", texte: "Un nom, une adresse e-mail, un mot de passe. Aucune carte bancaire." },
  { n: "02", titre: "Configurez votre restaurant", texte: "Vos produits, leurs prix, vos articles de stock et votre équipe." },
  { n: "03", titre: "Gérez votre activité", texte: "Saisissez ventes et dépenses au fil du service : les chiffres se calculent seuls." },
];

const TARIF_INCLUS = [
  "Produits, ventes et dépenses illimités",
  "Tableau de bord chiffre d'affaires & bénéfices",
  "Gestion complète du stock (ingrédients et boissons)",
  "Gestion d'équipe et accès par rôle",
  "Assistant intelligent illimité",
  "Reçus de performance partageables",
];

/* ------------------------------------------------------------------ Hero */

export function Hero({ c, theme, onStart, install }) {
  return (
    <Section className="pt-10 sm:pt-16 pb-12" wide>
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <Reveal>
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-6"
            style={{ backgroundColor: c.softViolet, border: `1px solid ${c.violet}40` }}
          >
            <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: c.green }} />
            <span className="text-[11px] font-semibold" style={{ color: c.violet }}>
              30 jours gratuits — sans carte bancaire
            </span>
          </div>

          <h1
            className="text-[34px] leading-[1.08] sm:text-5xl lg:text-[52px] font-bold font-display"
            style={{ color: c.ink }}
          >
            Le logiciel de gestion{" "}
            <span style={{ color: c.violet }}>de votre restaurant</span>
          </h1>

          <Lead c={c} className="mt-5 max-w-xl">
            Ventes, dépenses, stock, équipe et bénéfice réel : Margitrack réunit
            la gestion de votre établissement sur votre téléphone. Vous savez
            chaque soir ce que votre restaurant a vraiment gagné.
          </Lead>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <PrimaryButton c={c} onClick={onStart} className="w-full sm:w-auto">
              Commencer gratuitement
            </PrimaryButton>
            <GhostButton c={c} href="#produit" className="w-full sm:w-auto">
              Découvrir Margitrack
            </GhostButton>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6">
            {["Sans matériel de caisse", "En français", "Montants en FCFA"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs" style={{ color: c.muted }}>
                <Check c={c} size={16} /> {t}
              </span>
            ))}
          </div>

          {install}
        </Reveal>

        <Reveal delay={120}>
          <div className="relative">
            <Photo
              c={c}
              {...PHOTOS.hero}
              ratio="4 / 3"
              className="lg:ml-8"
            />
            {/* Le téléphone déborde sur la photo : l'outil et le lieu où il
                sert tiennent dans une seule image. */}
            <div className="hidden sm:block absolute -bottom-10 -left-2 lg:left-0 w-[40%] max-w-[210px]">
              <PhoneFrame c={c} name="dashboard" theme={theme} maxWidth={210} priority
                          alt="Tableau de bord Margitrack sur téléphone" />
            </div>
            <div className="sm:hidden mt-6">
              <PhoneFrame c={c} name="dashboard" theme={theme} maxWidth={230} priority
                          alt="Tableau de bord Margitrack sur téléphone" />
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------- Problème */

export function Probleme({ c }) {
  return (
    <Section className="py-14 sm:py-20">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <Eyebrow c={c}>Le quotidien aujourd'hui</Eyebrow>
          <Title c={c}>Votre restaurant mérite mieux que des cahiers et des calculs dispersés.</Title>
          <div className="mt-7 space-y-3">
            {PROBLEMES.map((p) => (
              <div key={p.text} className="flex items-start gap-3">
                <span className="shrink-0 text-lg leading-6" aria-hidden="true">{p.icon}</span>
                <p className="text-[15px] leading-relaxed" style={{ color: c.muted }}>{p.text}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <Photo c={c} {...PHOTOS.probleme} ratio="4 / 3" />
          <Card c={c} className="p-5 sm:p-6 mt-6" style={{ borderColor: `${c.violet}55` }}>
            <p className="text-sm font-semibold mb-1.5" style={{ color: c.violet }}>Avec Margitrack</p>
            <p className="text-[15px] leading-relaxed" style={{ color: c.ink }}>
              Une seule saisie au moment du service. Le chiffre d'affaires, le
              coût des marchandises vendues, les charges et le bénéfice se
              calculent ensuite tout seuls — et restent consultables à tout
              moment, par vous seul.
            </p>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- Produit */

export function Produit({ c, theme }) {
  return (
    <Section id="produit" className="py-14 sm:py-20" style={{ backgroundColor: c.band }}>
      <SectionHead
        c={c}
        eyebrow="L'application"
        title="Une vraie application, pas une promesse"
        lead="Les écrans présentés ici sont ceux de Margitrack, tels qu'ils s'affichent sur un téléphone. Les chiffres montrés servent d'exemple."
      />
      <Reveal>
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-4 items-start">
          <PhoneFrame c={c} name="ventes" theme={theme} maxWidth={260}
                      alt="Écran de saisie des ventes de Margitrack" />
          <PhoneFrame c={c} name="dashboard" theme={theme} maxWidth={280}
                      alt="Tableau de bord de Margitrack" className="sm:-mt-6" />
          <PhoneFrame c={c} name="stock" theme={theme} maxWidth={260}
                      alt="Écran de gestion du stock de Margitrack" />
        </div>
      </Reveal>
    </Section>
  );
}

/* -------------------------------------------------------- Fonctionnalités */

export function Fonctionnalites({ c }) {
  return (
    <Section id="fonctionnalites" className="py-14 sm:py-20">
      <SectionHead
        c={c}
        eyebrow="Fonctionnalités"
        title="Tout ce qu'il faut pour piloter votre établissement"
        lead="Neuf outils qui se parlent entre eux : une vente met le stock à jour, un achat nourrit les dépenses, et le bénéfice suit."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 80}>
            <Card c={c} className="p-5 h-full">
              <span
                className="inline-flex items-center justify-center rounded-2xl mb-4"
                style={{ width: 44, height: 44, backgroundColor: c.softViolet, color: c.violet }}
              >
                <f.Icon />
              </span>
              <p className="font-semibold mb-1.5" style={{ color: c.ink }}>{f.title}</p>
              <p className="text-sm leading-relaxed" style={{ color: c.muted }}>{f.text}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- Stock */

export function Stock({ c, theme }) {
  const points = [
    "Ingrédients et boissons, chacun avec son unité : kilo, litre, bouteille.",
    "Achat au casier ou au sac, suivi à la bouteille ou au kilo — la conversion est automatique.",
    "Chaque mouvement est tracé : achat, consommation en cuisine, perte, inventaire.",
    "La valeur du stock est calculée au coût moyen réel de vos achats.",
    "Un seuil par article déclenche l'alerte avant la rupture, pas après.",
    "Reliez un produit vendu à son article de stock : la vente déduit le stock toute seule.",
  ];
  return (
    <Section className="py-14 sm:py-20" style={{ backgroundColor: c.band }}>
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <Eyebrow c={c}>Stock</Eyebrow>
          <Title c={c}>Gardez le contrôle de vos stocks.</Title>
          <Lead c={c} className="mt-4">
            Ce qui entre, ce qui sort, ce qu'il reste et ce que tout cela vaut.
          </Lead>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Check c={c} />
                <span className="text-[15px] leading-relaxed" style={{ color: c.muted }}>{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <div className="relative">
            <Photo c={c} {...PHOTOS.stock} ratio="4 / 3" />
            <div className="hidden sm:block absolute -bottom-12 right-0 w-[42%] max-w-[200px]">
              <PhoneFrame c={c} name="stock" theme={theme} maxWidth={200}
                          alt="Écran du stock dans Margitrack" />
            </div>
            <div className="sm:hidden mt-6">
              <PhoneFrame c={c} name="stock" theme={theme} maxWidth={230}
                          alt="Écran du stock dans Margitrack" />
            </div>
          </div>
        </Reveal>
      </div>
      <div className="hidden sm:block h-12" />
    </Section>
  );
}

/* ---------------------------------------------------------------- Équipe */

export function Equipe({ c }) {
  return (
    <Section className="py-14 sm:py-20">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal className="order-2 lg:order-1" delay={120}>
          <Photo c={c} {...PHOTOS.equipe} ratio="4 / 3" />
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <Eyebrow c={c}>Équipe</Eyebrow>
          <Title c={c}>Votre équipe, avec les bons accès.</Title>
          <Lead c={c} className="mt-4">
            Enregistrez vos employés, leur rôle et leur salaire. Donnez un accès
            à Margitrack à ceux qui en ont besoin — les autres restent
            simplement dans la fiche d'équipe, sans compte à créer.
          </Lead>

          <div className="mt-6 space-y-2.5">
            {ACCESS_ROLES.map((role) => (
              <Card key={role.code} c={c} className="p-4">
                <p className="text-sm font-semibold mb-1.5" style={{ color: c.ink }}>{role.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(DEFAULT_PERMISSIONS[role.code] ?? []).map((perm) => (
                    <span
                      key={perm}
                      className="text-[11px] rounded-full px-2 py-0.5"
                      style={{ backgroundColor: c.elevated, color: c.muted }}
                    >
                      {PERMISSION_LABELS[perm] ?? perm}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color: c.muted }}>
            Ces accès sont modifiables : vous pouvez créer vos propres rôles et
            cocher exactement ce que chacun peut voir.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- Assistant */

export function Assistant({ c, theme }) {
  return (
    <Section className="py-14 sm:py-20" style={{ backgroundColor: c.band }}>
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <Eyebrow c={c}>Assistant intelligent</Eyebrow>
          <Title c={c}>Posez une question, obtenez une réponse tirée de vos chiffres.</Title>
          <Lead c={c} className="mt-4">
            L'assistant n'invente rien et ne devine rien : il lit les ventes,
            les dépenses et le stock de votre restaurant — les vôtres
            uniquement — et répond en français, en quelques phrases.
          </Lead>

          <div className="mt-6 space-y-2.5">
            {[
              "Quel est mon chiffre d'affaires cette semaine ?",
              "Quel est mon produit le plus rentable ?",
              "Mes dépenses ont-elles augmenté ?",
            ].map((q) => (
              <div
                key={q}
                className="rounded-2xl px-4 py-3 text-sm"
                style={{ backgroundColor: c.softViolet, color: c.ink, border: `1px solid ${c.violet}33` }}
              >
                « {q} »
              </div>
            ))}
          </div>

          <p className="text-xs mt-5 leading-relaxed" style={{ color: c.muted }}>
            Chaque matin, l'assistant résume aussi la journée de la veille :
            recettes, dépenses, bénéfice, valeur du stock, et deux ou trois
            conseils tirés des écarts réellement constatés.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <PhoneFrame c={c} name="assistant" theme={theme} maxWidth={300}
                      alt="Écran de l'assistant Margitrack" />
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- Dashboard */

export function TableauDeBord({ c, theme }) {
  const points = [
    "Chiffre d'affaires du jour, de la semaine ou du mois, comparé à la période précédente.",
    "Coût des marchandises vendues, séparé des autres dépenses.",
    "Bénéfice réel : ventes − marchandises vendues − charges.",
    "Taux de marge, part des dépenses dans le chiffre d'affaires, santé du stock.",
    "Courbe d'évolution, produits les plus vendus, répartition des dépenses.",
    "Alertes de rupture et de réapprovisionnement, visibles dès l'ouverture.",
  ];
  return (
    <Section className="py-14 sm:py-20" wide>
      <SectionHead
        c={c}
        eyebrow="Tableau de bord"
        title="Vos chiffres, lisibles en dix secondes"
        lead="Le même tableau de bord sur téléphone et sur ordinateur. Aucune formule à écrire, aucun tableur à tenir."
      />
      <div className="grid lg:grid-cols-5 gap-8 items-center">
        <Reveal className="lg:col-span-3">
          <WindowFrame c={c}>
            {/* Les deux captures n'ont pas la même hauteur : on les cadre à la
                même fenêtre, par le haut, plutôt que de laisser un vide. */}
            <div className="grid grid-cols-2">
              {[
                { name: "dashboard", alt: "Tableau de bord Margitrack — chiffre d'affaires, marchandises vendues, bénéfice" },
                { name: "graphiques", alt: "Indicateurs et courbe d'évolution du tableau de bord Margitrack" },
              ].map((shot) => (
                <div key={shot.name} className="overflow-hidden" style={{ aspectRatio: "400 / 560" }}>
                  <Screenshot
                    name={shot.name}
                    theme={theme}
                    alt={shot.alt}
                    className="h-full"
                    style={{ objectFit: "cover", objectPosition: "top" }}
                  />
                </div>
              ))}
            </div>
          </WindowFrame>
        </Reveal>
        <Reveal className="lg:col-span-2" delay={120}>
          <ul className="space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Check c={c} />
                <span className="text-[15px] leading-relaxed" style={{ color: c.muted }}>{p}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- Comment ça marche */

export function CommentCaMarche({ c }) {
  return (
    <Section className="py-14 sm:py-20" style={{ backgroundColor: c.band }}>
      <SectionHead c={c} eyebrow="Démarrage" title="Trois étapes, un après-midi" />
      <div className="grid sm:grid-cols-3 gap-4">
        {ETAPES.map((e, i) => (
          <Reveal key={e.n} delay={i * 90}>
            <Card c={c} className="p-6 h-full">
              <p className="font-display font-bold text-3xl mb-3" style={{ color: `${c.violet}` }}>{e.n}</p>
              <p className="font-semibold mb-1.5" style={{ color: c.ink }}>{e.titre}</p>
              <p className="text-sm leading-relaxed" style={{ color: c.muted }}>{e.texte}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ Essai + prix */

export function Essai({ c, onStart }) {
  return (
    <Section className="py-14 sm:py-16">
      <Reveal>
        <div
          className="rounded-[28px] p-7 sm:p-10 text-center"
          style={{
            background: `linear-gradient(135deg, ${c.violet}, ${c.violetDeep})`,
            boxShadow: `0 20px 50px ${c.glow}`,
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 mb-3">Essai gratuit</p>
          <h3 className="text-2xl sm:text-3xl font-bold font-display text-white">
            Essayez Margitrack gratuitement pendant 30 jours
          </h3>
          <p className="text-sm sm:text-base text-white/85 mt-4 max-w-xl mx-auto leading-relaxed">
            Toutes les fonctionnalités, sans carte bancaire et sans engagement.
            À la fin de l'essai, l'abonnement Pro prend le relais si vous le
            souhaitez — vos données, elles, ne sont jamais supprimées.
          </p>
          <button
            onClick={onStart}
            className="mt-7 rounded-full px-8 py-3.5 text-[15px] font-semibold bg-white transition-transform duration-200 active:scale-[0.98]"
            style={{ color: c.violetDeep }}
          >
            Commencer gratuitement
          </button>
        </div>
      </Reveal>
    </Section>
  );
}

export function Tarifs({ c, onStart }) {
  return (
    <Section id="tarifs" className="py-14 sm:py-20">
      <SectionHead
        c={c}
        eyebrow="Tarifs"
        title="Un tarif simple, pensé pour les petits établissements"
        lead="Un seul abonnement, tout compris. Pas de frais d'installation, pas de matériel à acheter."
      />
      <Reveal>
        <Card c={c} className="max-w-md mx-auto p-7 sm:p-9" style={{ borderColor: c.violet }}>
          <p className="font-semibold text-lg" style={{ color: c.ink }}>Margitrack Pro</p>
          <p className="mt-2">
            <span className="text-4xl font-bold font-display" style={{ color: c.ink }}>5 000 FCFA</span>
            <span style={{ color: c.muted }}> / mois</span>
          </p>
          <p className="text-xs mt-2" style={{ color: c.muted }}>
            Après vos 30 jours d'essai gratuit. Paiement sécurisé par Chariow.
          </p>
          <ul className="mt-6 space-y-2.5">
            {TARIF_INCLUS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check c={c} />
                <span className="text-sm" style={{ color: c.ink }}>{item}</span>
              </li>
            ))}
          </ul>
          <PrimaryButton c={c} onClick={onStart} className="w-full mt-7">
            Commencer gratuitement
          </PrimaryButton>
        </Card>
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------- FAQ / sécurité */

export function Faq({ c, items }) {
  return (
    <Section id="faq" className="py-14 sm:py-20" style={{ backgroundColor: c.band }}>
      <SectionHead c={c} eyebrow="FAQ" title="Questions fréquentes" />
      <div className="space-y-3 max-w-2xl mx-auto">
        {items.map((item) => (
          <details
            key={item.q}
            className="rounded-2xl p-4 sm:p-5"
            style={{ backgroundColor: c.card, border: `1px solid ${c.line}` }}
          >
            <summary className="font-medium cursor-pointer text-[15px]" style={{ color: c.ink }}>
              {item.q}
            </summary>
            <p className="text-sm mt-2.5 leading-relaxed" style={{ color: c.muted }}>{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Securite({ c }) {
  return (
    <Section className="py-12">
      <Reveal>
        <Card c={c} className="p-6 sm:p-8 text-center">
          <span
            className="inline-flex items-center justify-center rounded-2xl mb-4"
            style={{ width: 48, height: 48, backgroundColor: c.softGreen, color: c.green }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2.8 20 6v6.2c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3.2Z" />
              <path d="m8.8 12.2 2.2 2.2 4.2-4.4" />
            </svg>
          </span>
          <h3 className="text-lg sm:text-xl font-bold font-display mb-2" style={{ color: c.ink }}>
            Vos données sont en sécurité
          </h3>
          <Lead c={c} className="max-w-xl mx-auto">
            Chaque restaurant dispose d'un espace totalement isolé : vos ventes,
            vos dépenses et vos données d'équipe ne sont jamais accessibles par
            un autre restaurant. Les paiements sont traités de manière sécurisée
            par Chariow.
          </Lead>
        </Card>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------- CTA finale */

export function CtaFinale({ c, onStart, theme }) {
  return (
    <Section className="py-16 sm:py-24">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <Title c={c}>Votre restaurant mérite une gestion plus simple.</Title>
          <Lead c={c} className="mt-4 max-w-lg">
            Centralisez vos ventes, dépenses, stocks et équipe avec Margitrack.
          </Lead>
          <div className="mt-7">
            <PrimaryButton c={c} onClick={onStart}>Commencer gratuitement</PrimaryButton>
          </div>
          <p className="text-xs mt-4" style={{ color: c.muted }}>
            30 jours d'essai gratuit — sans carte bancaire, sans engagement.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <Photo c={c} {...PHOTOS.gerant} ratio="16 / 10" />
        </Reveal>
      </div>
    </Section>
  );
}
