# Photos du menu « Le Baobab »

## Ce qui est déjà en place

19 emplacements affichent de vraies photos, hébergées par **Wikimedia Commons**
et publiées sous licence Creative Commons. Elles sont appelées par une URL
stable :

```
https://commons.wikimedia.org/wiki/Special:FilePath/Poulet_Yassa.JPG?width=400
```

La liste complète (fichier, largeur, texte alternatif, page d'origine) est dans
`sources.json`, et la page affiche les crédits dans un bloc « Crédits photos »
en bas de carte — c'est ce que la licence exige.

Si une photo ne charge pas, elle est retirée automatiquement et l'emplacement
dessiné reprend sa place : la carte n'affiche jamais d'image cassée.

## Rapatrier les photos en local (recommandé avant mise en production)

```bash
node scripts/baobab-photos.mjs
```

Le script télécharge chaque image dans ce dossier et réécrit les `src` de la
page vers `photos/…`. La carte devient alors autonome, plus rapide, et ne
dépend plus d'un serveur extérieur. Relancer le script est sans risque
(`--force` pour retélécharger).

Compressez ensuite les fichiers — visez moins de 200 Ko par image :

```bash
mogrify -resize 800x -quality 72 public/baobab/photos/*.jpg
```

## Mettre vos propres photos

C'est évidemment le but final : les photos de vos plats valent mieux que
n'importe quelle banque d'images.

1. Déposez vos fichiers ici, en minuscules et sans accent (`poisson-braise.jpg`).
2. Dans `../index.html`, remplacez l'URL par le chemin local :

```html
<img src="photos/poisson-braise.jpg" alt="Poisson braisé entier" loading="lazy">
```

Pour les emplacements encore vides, il suffit de décommenter la balise :

```html
<div class="cliche" data-libelle="Photo">
  <!-- <img src="photos/accras.jpg" alt="Accras de morue"> -->
</div>
```

Quand tous les visuels sont à vous, supprimez le bloc « Crédits photos » du
pied de page.

## Formats

- **Vignettes des plats** : carrées (recadrage automatique au centre), 800 px suffisent.
- **Deux grandes photos** (thiéboudiène, jus de bouye) : format 16/10, 1200 px de large.
- **Bandeau d'accueil** : une grande image à gauche, deux carrés à droite.
- Toujours renseigner `alt` avec le nom du plat.
