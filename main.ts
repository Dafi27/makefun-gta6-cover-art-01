/* Palm Heat Cover Lab — program entrypoint (Node, stdlib only).
   Copies app/ and screenshots/ to the output directory and writes
   /output/dossier.json with buildDossier from vendor/makefun-app.ts. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(name) {
  const src = path.join(repoRoot, name);
  const dst = path.join(outDir, name);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
}

fs.mkdirSync(outDir, { recursive: true });
copyTree('app');
copyTree('screenshots');

const dossier = await buildDossier(repoRoot, { text_max_bytes: 163840 });
fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${path.join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
