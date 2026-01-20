// @ts-check
import { defineManifest } from '../packages/crx-monkey/dist/node/exports.js';

export default defineManifest({
  manifest_version: 3,
  name: 'test script',
  version: '0.0.1',
  content_scripts: [
    {
      js: ['content_scripts/main.ts'],
      css: ['content_scripts/style.scss'],
      matches: ['<all_urls>'],
      userscript_direct_inject: false,
      use_isolated_connection: true,
      trusted_inject: true,
    },
  ],
  background: {
    service_worker: 'sw/main.ts',
  },
  action: {
    default_popup: 'popup/index.html',
  },
  icons: {
    16: './assets/icons/icon16.png',
    48: './assets/icons/icon48.png',
    128: './assets/icons/icon128.png',
  },
});
