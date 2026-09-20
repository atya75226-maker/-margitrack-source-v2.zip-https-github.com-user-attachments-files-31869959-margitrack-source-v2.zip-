# Photos du menu « Le Baobab »

## Ce qui est en place

**Les 31 emplacements de la carte affichent une photo. Aucun n'est vide.**

Les images viennent de deux sources libres de droits :

- **Pexels** — licence Pexels : usage commercial autorisé, sans attribution
  obligatoire. URL du type
  `https://images.pexels.com/photos/5704254/pexels-photo-5704254.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=320&h=320`
- **Wikimedia Commons** — licence Creative Commons, pour l'alloco et l'attiéké,
  que les banques d'images généralistes ne couvrent pas. Ces deux-là sont
  créditées dans le bloc « Crédits photos » en pied de carte, comme la licence
  l'exige.

Les paramètres d'URL font le travail d'optimisation côté serveur :
`w=320&h=320&fit=crop` pour les vignettes (≈ 25 Ko), `w=900&h=560` pour les
deux grandes photos. Tout est en `loading="lazy"` : seules les premières images
sont chargées à l'ouverture.

## Double filet de sécurité

Chaque balise porte une URL de secours :

```html
<img src="https://images.pexels.com/photos/1510714/…"
     data-secours="https://commons.wikimedia.org/wiki/Special:FilePath/…"
     alt="Poisson braisé entier" loading="lazy">
```

Si la première ne répond pas, la seconde prend le relais. Si les deux échouent,
l'image est retirée et l'emplacement dessiné reprend sa place — la carte
n'affiche jamais d'icône d'image cassée.

## Vérifier que tout s'affiche

Depuis une machine avec un accès Internet normal :

```bash
node scripts/verifier-photos.mjs
```

Le script interroge les 31 URL principales puis les secours, et affiche plat
par plat ce qu'un téléphone verra. Il sort en erreur si un plat se retrouve
sans image.

## Rapatrier les photos en local (recommandé avant production)

```bash
node scripts/baobab-photos.mjs
```

Télécharge chaque image dans ce dossier (`poulet-braise.jpg`,
`spaghetti-bolognaise.jpg`, …) et réécrit les `src` vers `photos/…`. La carte
devient autonome, plus rapide, et ne dépend plus d'aucun serveur extérieur.
Puis compressez :

```bash
mogrify -resize 800x -quality 72 public/baobab/photos/*.jpg
```

## Mettre vos propres photos

C'est le but final : les photos de vos plats valent mieux que n'importe quelle
banque d'images. Déposez vos fichiers ici et remplacez l'URL par le chemin
local :

```html
<img src="photos/poulet-braise.jpg" alt="Poulet braisé" loading="lazy">
```

Supprimez alors l'attribut `data-secours` devenu inutile, et le bloc
« Crédits photos » du pied de page.

Formats : vignettes carrées (recadrage automatique au centre, 800 px suffisent),
grandes photos en 16/10 (1200 px de large). Toujours renseigner `alt`.
