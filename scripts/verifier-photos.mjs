#!/usr/bin/env node
/**
 * Vérifie que chaque photo de la carte « Le Baobab » répond bien en HTTPS.
 *
 *   node scripts/verifier-photos.mjs
 *
 * À lancer depuis une machine avec un accès Internet normal. Le script
 * interroge l'URL principale de chaque plat, puis son URL de secours, et
 * indique exactement ce qu'un téléphone verra en ouvrant la page.
 *
 * Code de sortie : 0 si chaque plat a au moins une image qui répond,
 * 1 s'il en manque au moins une.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(
  await readFile(join(racine, 'public', 'baobab', 'photos', 'sources.json'), 'utf8'));

const UA = 'LeBaobab-Menu/1.0 (verification des photos du menu)';

async function teste(url) {
  if (!url) return { ok: false, detail: 'aucune URL' };
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
    if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
    const type = r.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return { ok: false, detail: `type ${type || 'inconnu'}` };
    const taille = Number(r.headers.get('content-length') || 0);
    return { ok: true, detail: taille ? `${Math.round(taille / 1024)} Ko` : type };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}

let principales = 0, secours = 0;
const perdues = [];

for (const photo of sources) {
  const p = await teste(photo.url);
  if (p.ok) {
    principales++;
    console.log(`✓ ${photo.nom} — ${p.detail}`);
    continue;
  }
  const s = await teste(photo.secours);
  if (s.ok) {
    secours++;
    console.log(`→ ${photo.nom} — image principale HS (${p.detail}), secours OK (${s.detail})`);
  } else {
    perdues.push({ ...photo, p, s });
    console.log(`✗ ${photo.nom} — principale ${p.detail}, secours ${s.detail}`);
  }
}

console.log(`\n${sources.length} plats · ${principales} image(s) principale(s) OK · ` +
            `${secours} servie(s) par le secours · ${perdues.length} sans image.`);

if (perdues.length) {
  console.log('\nÀ remplacer dans public/baobab/index.html :');
  for (const q of perdues) console.log(`  · ${q.nom} → ${q.url}`);
  process.exit(1);
}
console.log('Toutes les photos de la carte répondent.');
