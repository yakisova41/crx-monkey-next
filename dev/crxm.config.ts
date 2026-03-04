import {
  defineConfig,
  esbuildCSSPlugin,
  reactWatch,
  tsBundler,
  tsBundlerWatch,
} from '../packages/crx-monkey/dist/node/exports.js';

const config = defineConfig({
  server: {},
  public: './public',
  header: [['@author', 'developer']],
  popup_in_userscript: true,
  manifest: './manifest.ts',
  watch: {
    '\\.(ts|js)x$': tsBundlerWatch({
      esbuild: {
        plugins: [esbuildCSSPlugin()],
      },
    }),
    '\\.(ts|js)$': tsBundlerWatch(),
  },
  build: {
    '\\.(ts|js|jsx|tsx)$': tsBundler({ esbuild: { plugins: [esbuildCSSPlugin()] } }),
  },
});
export default config;
