/**
 * Emplacements photo de la page d'accueil.
 *
 * Chaque entrée décrit une photographie à déposer dans
 * `public/images/photos/` sous le nom indiqué. Tant que le fichier n'existe
 * pas, la page affiche une composition de remplacement aux couleurs de
 * Margitrack (voir `Photo` dans ui.jsx) : jamais d'image cassée.
 *
 * Aucune adresse d'image extérieure n'est utilisée. Une photo servie depuis
 * un autre site peut disparaître, ralentir la page ou être bloquée ; celles
 * de Margitrack sont servies par Margitrack.
 */
export const PHOTOS = {
  hero: {
    src: "/images/photos/comptoir.jpg",
    alt: "Comptoir d'un restaurant, une personne enregistre une commande",
    icon: "🏪",
    label: "Comptoir du restaurant",
  },
  probleme: {
    src: "/images/photos/cahier.jpg",
    alt: "Cahier de comptes, calculatrice et reçus sur une table",
    icon: "🧾",
    label: "Cahier, calculatrice et reçus",
  },
  stock: {
    src: "/images/photos/reserve.jpg",
    alt: "Réserve d'un restaurant : casiers de boissons, cartons et sacs",
    icon: "📦",
    label: "Réserve et casiers de boissons",
  },
  equipe: {
    src: "/images/photos/equipe.jpg",
    alt: "Équipe d'un restaurant en service",
    icon: "👥",
    label: "Équipe en service",
  },
  gerant: {
    src: "/images/photos/gerant.jpg",
    alt: "Gérante de restaurant consultant ses chiffres sur un téléphone",
    icon: "📱",
    label: "Gérant et ses chiffres",
  },
};
