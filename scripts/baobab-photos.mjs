#!/usr/bin/env node
/**
 * Rapatrie les photos de la carte « Le Baobab » et bascule la page sur les
 * fichiers locaux.
 *
 *   node scripts/baobab-photos.mjs
 *
 * Par défaut la page pointe vers Pexels et Wikimedia Commons : elle fonctionne
 * immédiatement, mais chaque visiteur dépend d'un serveur extérieur. Ce script
 * télécharge les images dans `public/baobab/photos/` et réécrit les `src` — la
 * page devient alors entièrement autonome et bien plus rapide.
 *
 * Si l'image principale ne répond pas, le script prend automatiquement l'URL
 * de secours. Relancer est sans risque (`--force` pour retélécharger).
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossierPhotos = join(racine, 'public', 'baobab', 'photos');
const pageHtml = join(racine, 'public', 'baobab', 'index.html');
const force = process.argv.includes('--force');
const UA = 'LeBaobab-Menu/1.0 (page de menu de restaurant)';

const existe = (chemin) => stat(chemin).then(() => true, () => false);

/** « Poisson braisé entier » -> « poisson-braise-entier » */
const slug = (texte) => texte
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sources = JSON.parse(await readFile(join(dossierPhotos, 'sources.json'), 'utf8'));
await mkdir(dossierPhotos, { recursive: true });

let html = await readFile(pageHtml, 'utf8');
let telecharges = 0, ignores = 0;
const echecs = [];
const pris = new Set();

async function recupere(url) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const octets = Buffer.from(await r.arrayBuffer());
  if (octets.length < 1024) throw new Error('fichier suspect (trop petit)');
  return octets;
}

for (const photo of sources) {
  // Un nom de fichier stable et unique par plat.
  let base = slug(photo.nom);
  let n = 2;
  while (pris.has(base)) { base = `${slug(photo.nom)}-${n++}`; }
  pris.add(base);

  const nomFichier = `${base}.jpg`;
  const destination = join(dossierPhotos, nomFichier);

  if (!force && (await existe(destination))) {
    ignores++;
  } else {
    process.stdout.write(`↓ ${nomFichier} … `);
    let octets = null;
    for (const url of [photo.url, photo.secours]) {
      if (!url) continue;
      try { octets = await recupere(url); break; }
      catch { /* on tente le secours */ }
    }
    if (!octets) {
      console.log('échec');
      echecs.push(photo);
      continue;
    }
    await writeFile(destination, octets);
    console.log(`${Math.round(octets.length / 1024)} Ko`);
    telecharges++;
  }

  // La page pointe désormais sur le fichier local.
  html = html.replaceAll(`src="${photo.url}"`, `src="photos/${nomFichier}"`);
}

await writeFile(pageHtml, html);

console.log(`\n${telecharges} photo(s) téléchargée(s), ${ignores} déjà présente(s).`);
if (echecs.length) {
  console.log(`\n${echecs.length} échec(s) — ces plats gardent leur URL distante :`);
  for (const e of echecs) console.log(`  · ${e.nom}`);
}
console.log('\nPensez à compresser avant de déployer :');
console.log('  mogrify -resize 800x -quality 72 public/baobab/photos/*.jpg');
