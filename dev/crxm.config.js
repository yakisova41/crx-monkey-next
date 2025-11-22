import {
  defineConfig,
  tsBundler,
  tsBundlerWatch,
} from '../packages/crx-monkey/dist/client/main.js';

const config = defineConfig({
  watch: {
    '^.*.(ts|js|tsx|jsx)$': tsBundlerWatch({ tsconfig: './tsconfig.json', typeCheck: false }),
  },
  build: { '^.*.(ts|js|tsx|jsx)$': tsBundler({ tsconfig: './tsconfig.json', typeCheck: true }) },
  server: {
    disable_sock_in_userjs: true,
  },
  logLevel: 'error',
  public: './public',
});
export default config;
