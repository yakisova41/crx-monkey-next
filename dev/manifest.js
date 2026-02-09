// @ts-check
import { defineManifest } from '../packages/crx-monkey/dist/node/exports.js';

export default defineManifest({
  manifest_version: 3,
  name: 'test script',
  version: '0.0.1',
  content_scripts: [
    {
      js: ['content_scripts/content_script.ts'],
      css: ['content_scripts/content_style.scss'],
      matches: ['<all_urls>'],
      userscript_direct_inject: false,
      use_isolated_connection: true,
      trusted_inject: true,
      world: 'MAIN',
    },
  ],
  background: {
    service_worker: 'sw/sw.ts',
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
