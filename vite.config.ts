/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * public/assets je súkromný podmodul. Do buildu nesmú ísť pôvodné balíky
 * (_source), texty licencií ani README súbory – iba to, čo hra používa.
 */
function stripPrivateAssetFiles(): Plugin {
  return {
    name: 'strip-private-asset-files',
    apply: 'build',
    closeBundle() {
      const out = resolve(import.meta.dirname, 'dist/assets');
      for (const p of [
        '_source',
        '_signing',
        'licenses',
        'README.md',
        '.gitattributes',
        '.git',
        '.gitkeep',
      ]) {
        rmSync(resolve(out, p), { recursive: true, force: true });
      }
      rmSync(resolve(out, 'sprites/cats/popshop/README.md'), { force: true });
      rmSync(resolve(out, 'audio/sfx/extra/README.md'), { force: true });
    },
  };
}

/**
 * Voliteľné zvuky v public/assets/audio/sfx/extra/ (pozri src/sfx.ts).
 * Vráti { meno: [cesty] } v poradí ogg, mp3, wav – Phaser vyberie prvý formát, ktorý zariadenie prehrá.
 */
function findExtraSfx(): Record<string, string[]> {
  const dir = resolve(import.meta.dirname, 'public/assets/audio/sfx/extra');
  if (!existsSync(dir)) return {};
  const order = ['ogg', 'mp3', 'wav'];
  const out: Record<string, string[]> = {};
  for (const file of readdirSync(dir).sort()) {
    const m = /^([a-z0-9_-]+)\.(ogg|mp3|wav)$/i.exec(file);
    if (!m) continue;
    const name = m[1]!.toLowerCase();
    (out[name] ??= []).push(`assets/audio/sfx/extra/${file}`);
  }
  for (const list of Object.values(out)) {
    list.sort(
      (a, b) =>
        order.indexOf(a.split('.').pop()!.toLowerCase()) -
        order.indexOf(b.split('.').pop()!.toLowerCase()),
    );
  }
  return out;
}

export default defineConfig({
  define: {
    __EXTRA_SFX__: JSON.stringify(findExtraSfx()),
  },
  base: './',
  build: {
    assetsDir: 'js',
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [stripPrivateAssetFiles()],
  test: {
    setupFiles: ['tests/setup.ts'],
  },
});
