import { defineConfig, type Plugin } from 'vite';
import { rmSync } from 'node:fs';
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
      for (const p of ['_source', 'licenses', 'README.md', '.gitattributes', '.git', '.gitkeep']) {
        rmSync(resolve(out, p), { recursive: true, force: true });
      }
      rmSync(resolve(out, 'sprites/cats/popshop/README.md'), { force: true });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    assetsDir: 'js',
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [stripPrivateAssetFiles()],
});
