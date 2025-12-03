// @ts-check
import { defineConfig } from '../packages/crx-monkey/dist/node/exports.js';

const config = defineConfig({
  server: {},
  public: './public',
  header: [['@author', 'developer']],
  logLevel: 'info',
});
export default config;
