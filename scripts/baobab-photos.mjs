#!/usr/bin/env node
/**
 * Télécharge les photos de la carte « Le Baobab » et bascule la page sur les
 * fichiers locaux.
 *
 *   node scripts/baobab-photos.mjs
 *
 * Par défaut, la page pointe vers Wikimedia Commons : elle fonctionne
 * immédiatement, mais chaque visiteur dépend d'un serveur extérieur. Ce script
 * rapatrie les images dans `public/baobab/photos/` et réécrit les `src` — la
 * page devient alors entièrement autonome et bien plus rapide.
 *
 * Relancer le script est sans risque : les fichiers déjà présents sont ignorés
 * (`--force` pour les retélécharger).
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossierPhotos = join(racine, 'public', 'baobab', 'photos');
const pageHtml = join(racine, 'public', 'baobab', 'index.html');
const manifeste = join(dossierPhotos, 'sources.json');
const force = process.argv.includes('--force');

const existe = async (chemin) => stat(chemin).then(() => true, () => false);

const sources = JSON.parse(await readFile(manifeste, 'utf8'));
await mkdir(dossierPhotos, { recursive: true });

let html = await readFile(pageHtml, 'utf8');
let telecharges = 0, ignores = 0;
const echecs = [];

for (const photo of sources) {
  const nomFichier = photo.local.replace(/^photos\//, '');
  const destination = join(dossierPhotos, nomFichier);

  if (!force && (await existe(destination))) {
    ignores++;
  } else {
    process.stdout.write(`↓ ${nomFichier} … `);
    try {
      const reponse = await fetch(photo.url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'LeBaobab-Menu/1.0 (page de menu de restaurant)' },
      });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const octets = Buffer.from(await reponse.arrayBuffer());
      if (octets.length < 1024) throw new Error('fichier suspect (trop petit)');
      await writeFile(destination, octets);
      console.log(`${Math.round(octets.length / 1024)} Ko`);
      telecharges++;
    } catch (erreur) {
      console.log('échec');
      echecs.push({ fichier: nomFichier, raison: erreur.message, page: photo.page });
      continue;
    }
  }

  // La page pointe désormais sur le fichier local.
  html = html.replaceAll(`src="${photo.url}"`, `src="${photo.local}"`);
}

await writeFile(pageHtml, html);

console.log(`\n${telecharges} photo(s) téléchargée(s), ${ignores} déjà présente(s).`);
if (echecs.length) {
  console.log(`\n${echecs.length} échec(s) — ces emplacements gardent leur habillage :`);
  for (const e of echecs) console.log(`  · ${e.fichier} (${e.raison}) → ${e.page}`);
}
console.log('\nPensez à compresser les images avant de déployer (squoosh.app, ou');
console.log('`mogrify -resize 800x -quality 72 public/baobab/photos/*.jpg`).');
