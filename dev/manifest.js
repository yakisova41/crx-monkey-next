import { defineManifest } from '../packages/crx-monkey/dist/client/main.js';

export default defineManifest({
  manifest_version: 3,
  name: 'test script',
  version: '0.0.1',
  content_scripts: [
    {
      js: ['content_scripts/main.ts'],
      css: ['content_scripts/style.css'],
      matches: ['https://x.com/*'],
      use_isolated_connection: true,
      userscript_direct_inject: true,
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
