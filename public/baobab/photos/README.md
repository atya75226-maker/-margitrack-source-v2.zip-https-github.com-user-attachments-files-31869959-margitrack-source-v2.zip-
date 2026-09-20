# Photos du menu « Le Baobab »

Déposez vos images ici, puis activez-les dans `../index.html`.

## Mode d'emploi

Chaque emplacement photo ressemble à ceci dans la page :

```html
<div class="cliche" data-libelle="Photo">
  <!-- <img src="photos/yassa.jpg" alt="Yassa poulet"> -->
</div>
```

Retirez les `<!--` et `-->` pour afficher la photo :

```html
<div class="cliche" data-libelle="Photo">
  <img src="photos/yassa.jpg" alt="Yassa poulet">
</div>
```

Tant qu'une photo n'est pas activée, l'emplacement reste habillé (fond rayé +
libellé) : la mise en page ne bouge pas.

## Conseils

- **Format** : JPEG ou WebP. Les vignettes des plats sont carrées (recadrage
  automatique au centre), les deux grandes photos sont en 16/10.
- **Taille** : 800 px de côté suffisent pour les vignettes, 1200 px de large
  pour les grandes photos. Compressez à moins de 200 Ko par image pour que la
  page reste instantanée sur un forfait mobile.
- **Nommage** : minuscules, sans accent ni espace (`poisson-braise.jpg`).
- **Texte alternatif** : remplissez toujours `alt` avec le nom du plat.
