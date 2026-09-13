import React from "react";

/**
 * Jeu d'icônes de l'application.
 *
 * Des tracés vectoriels plutôt que des emoji : ceux-ci sont rendus par le
 * système, leur dessin et leur taille changent donc d'un téléphone à l'autre,
 * ils ne prennent pas la couleur de l'onglet actif et donnent à l'interface
 * un air de brouillon. Ici tout est dessiné à la même grille de 24 px, avec
 * la même épaisseur de trait, et hérite de `currentColor`.
 *
 * Écrites à la main pour éviter d'ajouter une bibliothèque d'icônes entière
 * au paquet livré, alors que sept symboles suffisent.
 */
function Svg({ children, size = 24, strokeWidth = 1.75, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 10.6 12 3.2l9 7.4" />
      <path d="M5.6 9.6V19a1.6 1.6 0 0 0 1.6 1.6h9.6a1.6 1.6 0 0 0 1.6-1.6V9.6" />
      <path d="M9.6 20.6v-5.4a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v5.4" />
    </Svg>
  );
}

export function SalesIcon(props) {
  return (
    <Svg {...props}>
      <path d="M6.2 2.8h11.6a1 1 0 0 1 1 1v17.4l-2.6-1.6-2.1 1.6-2.1-1.6-2.1 1.6-2.6-1.6V3.8a1 1 0 0 1 1-1Z" />
      <path d="M9.2 7.8h5.6" />
      <path d="M9.2 11.6h5.6" />
      <path d="M9.2 15.4h3" />
    </Svg>
  );
}

export function ProductsIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 2.9 20 7.4v9.2L12 21.1 4 16.6V7.4L12 2.9Z" />
      <path d="m4 7.4 8 4.5 8-4.5" />
      <path d="M12 11.9v9.2" />
    </Svg>
  );
}

export function StockIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3.6" width="18" height="4.4" rx="1.2" />
      <path d="M5.2 8v11a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V8" />
      <path d="M10 12.4h4" />
    </Svg>
  );
}

export function ExpensesIcon(props) {
  return (
    <Svg {...props}>
      <path d="M18.6 8.2V6.6A1.6 1.6 0 0 0 17 5H5.8A2.8 2.8 0 0 0 3 7.8v8.8a2.8 2.8 0 0 0 2.8 2.8H17a1.6 1.6 0 0 0 1.6-1.6v-1.6" />
      <path d="M20.4 10.4h-3.9a2 2 0 0 0 0 4h3.9a.6.6 0 0 0 .6-.6v-2.8a.6.6 0 0 0-.6-.6Z" />
    </Svg>
  );
}

export function AssistantIcon(props) {
  return (
    <Svg {...props}>
      <path d="M11.2 3.4 12.9 8l4.6 1.7-4.6 1.7-1.7 4.6-1.7-4.6L4.9 9.7 9.5 8l1.7-4.6Z" />
      <path d="M18 14.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
    </Svg>
  );
}

export function SettingsIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.4a1.5 1.5 0 0 0 .3 1.65l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.14a1.8 1.8 0 1 1-3.6 0v-.08a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.05.05A1.8 1.8 0 1 1 4.47 16.1l.05-.05a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9H3.3a1.8 1.8 0 1 1 0-3.6h.08a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.05-.05A1.8 1.8 0 1 1 6.95 4.67l.05.05a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37V3.5a1.8 1.8 0 1 1 3.6 0v.08a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.14a1.8 1.8 0 1 1 0 3.6h-.08a1.5 1.5 0 0 0-1.37.9Z" />
    </Svg>
  );
}

/** Correspondance entre un onglet et son symbole. */
export const NAV_ICONS = {
  dashboard: HomeIcon,
  sales: SalesIcon,
  products: ProductsIcon,
  stock: StockIcon,
  expenses: ExpensesIcon,
  assistant: AssistantIcon,
  settings: SettingsIcon,
};
