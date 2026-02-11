import { defineConfig } from '../packages/crx-monkey/dist/node/exports.js';

const config = defineConfig({
  server: {},
  public: './public',
  header: [['@author', 'developer']],
  logLevel: 'info',
  popup_in_userscript: true,
  manifest: './manifest.ts',
});
export default config;
