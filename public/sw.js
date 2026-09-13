// Service worker de Margitrack.
//
// Il couvre uniquement l'application (/app). Le site vitrine reste une page
// web ordinaire : le mettre en cache n'apporterait rien et risquerait de
// l'afficher dans la fenetre de l'application installee.
//
// Aucune requete vers Supabase n'est interceptee : les donnees doivent
// toujours venir du serveur, jamais d'un cache perime.

const VERSION = "margitrack-v2";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

const SHELL_URLS = [
  "/app",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

// Les fichiers produits par le build portent une empreinte dans leur nom, qui
// change a chaque deploiement : impossible de les lister ici. On les decouvre
// en lisant la page elle-meme. Sans eux, la coquille en cache s'ouvrirait sur
// un ecran blanc hors ligne.
async function cacheReferencedAssets(html) {
  const found = html.match(/\/assets\/[A-Za-z0-9_.\-]+/g);
  if (!found) return;
  const cache = await caches.open(ASSETS);
  await Promise.allSettled([...new Set(found)].map((url) => cache.add(url)));
}

async function precache() {
  const cache = await caches.open(SHELL);
  // Une ressource manquante ne doit pas faire echouer toute l'installation.
  await Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)));

  try {
    const response = await fetch("/app", { cache: "no-store" });
    if (response.ok) {
      await cache.put("/app", response.clone());
      await cacheReferencedAssets(await response.text());
    }
  } catch {
    // Installation hors ligne : le cache se remplira a la premiere visite.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Tout ce qui sort du domaine (Supabase, polices) passe sans interception.
  if (url.origin !== self.location.origin) return;

  // Navigation : on privilegie le reseau pour recuperer la derniere version,
  // et on retombe sur la coquille en cache si la connexion manque.
  if (request.mode === "navigate") {
    if (!url.pathname.startsWith("/app")) return;
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL);
            await cache.put("/app", response.clone());
            // Un nouveau deploiement change les empreintes des fichiers : on
            // met en cache ceux de cette version, sinon le mode hors ligne
            // resterait bloque sur les fichiers de la version precedente.
            await cacheReferencedAssets(await response.clone().text());
          }
          return response;
        })
        .catch(() =>
          caches
            .match("/app", { ignoreVary: true })
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Fichiers du build, icones et logo : leur contenu ne change pas sans que
  // leur nom change, un cache ne peut donc jamais etre perime.
  //
  // ignoreVary est indispensable : les reponses portent « Vary: Origin », et
  // les balises <script crossorigin> emettent un en-tete Origin absent des
  // requetes de mise en cache. Sans cela la correspondance echoue et
  // l'application s'ouvre sur un ecran blanc hors ligne, alors meme que les
  // fichiers sont presents dans le cache.
  const isStatic =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/manifest.webmanifest";

  if (isStatic) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
