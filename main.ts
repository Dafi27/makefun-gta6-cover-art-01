import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Hands the built app in: copies app/ and screenshots/ from this
// repository to the output directory and writes dossier.json there
// with buildDossier from vendor/makefun-app.ts. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// The dossier's source text is capped at 163,840 UTF-8 bytes.
const TEXT_MAX_BYTES = 163840;

function copyDir(name: string): void {
  const dest = join(outDir, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(repoRoot, name), dest, { recursive: true });
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  copyDir('app');
  copyDir('screenshots');
  const dossier = await buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
  });
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  console.log(`wrote ${dossierPath} (${dossier.byteLength} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
