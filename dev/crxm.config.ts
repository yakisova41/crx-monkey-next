import {
  defineConfig,
  reactWatch,
  tsBundlerWatch,
} from '../packages/crx-monkey/dist/node/exports.js';

const config = defineConfig({
  server: {},
  public: './public',
  header: [['@author', 'developer']],
  logLevel: 'info',
  popup_in_userscript: true,
  manifest: './manifest.ts',
  watch: {
    '\\.(ts|js)x$': reactWatch(),
    '\\.(ts|js)$': tsBundlerWatch(),
  },
});
export default config;
