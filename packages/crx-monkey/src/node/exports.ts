import {
  CrxmConfig,
  CrxmConfigRequired,
  CrxmManifest,
  CrxmManifestImportantKeyRequired,
} from './typeDefs';
import { tsBundler, tsBundlerWatch } from './plugins/tsBundler';
import { sassBundler, sassBundlerWatch } from './plugins/sassBundler';
import { htmlBundler, htmlBundlerWatch } from './plugins/htmlBundler/main';

/**
 * Define config for crx monkey.
 * @param userConfig
 * @returns
 */
export function defineConfig(userConfig: CrxmConfig): CrxmConfigRequired {
  const defaultConfig: CrxmConfigRequired = {
    output: {
      chrome: 'dist/chrome',
      userjs: 'dist/bundle.user.js',
    },
    manifest: 'manifest.js',
    server: {
      port: 8080,
      host: 'localhost',
      websocket: 8081,
      disable_sock_in_userjs: false,
    },
    header: [],
    build: {
      '^.*.(ts|js|tsx|jsx)$': tsBundler({
        esbuild: {
          minify: true,
        },
      }),
      '^.*.(css|sass|scss)$': sassBundler(),
      '^.*.(html|htm)$': htmlBundler({
        output: 'dist/chrome',
        plugins: {
          build: { '^.*.(ts|js|tsx|jsx)$': tsBundler(), '^.*.(css|sass|scss)$': sassBundler() },
          watch: {
            '^.*.(ts|js|tsx|jsx)$': tsBundlerWatch(),
            '^.*.(css|sass|scss)$': sassBundlerWatch(),
          },
        },
      }),
    },
    watch: {
      '^.*.(ts|js|tsx|jsx)$': tsBundlerWatch({
        esbuild: {
          sourcemap: 'inline',
        },
      }),
      '^.*.(css|sass|scss)$': sassBundlerWatch(),
      '^.*.(html|htm)$': htmlBundlerWatch({
        output: 'dist/chrome',
        plugins: {
          build: { '^.*.(ts|js|tsx|jsx)$': tsBundler(), '^.*.(css|sass|scss)$': sassBundler() },
          watch: {
            '^.*.(ts|js|tsx|jsx)$': tsBundlerWatch(),
            '^.*.(css|sass|scss)$': sassBundlerWatch(),
          },
        },
      }),
    },
    logLevel: 'error',
    public: false,
    define: {
      sw: {},
      contentscripts: {},
      popup: {},
    },
  };

  return makeDefineFunc(defaultConfig, userConfig);
}

/**
 * Define manifest
 * @param userManifest
 * @returns
 */
export function defineManifest(userManifest: CrxmManifest): CrxmManifestImportantKeyRequired {
  const defaultManifest: CrxmManifestImportantKeyRequired = {
    description: '',
    manifest_version: 3,
    background: undefined,
    content_scripts: [],
    name: '',
    version: '',
    action: undefined,
    icons: undefined,
  };

  return makeDefineFunc(defaultManifest, userManifest);
}

function makeDefineFunc<T, U>(defaultConfig: T, userConfig: U) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isObject(item: any): item is Record<string, any> {
    // null もオブジェクトと判定されるのを防ぐ
    return (
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      item !== null &&
      !Array.isArray(item) &&
      item !== undefined
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mergeDeep(target: any, source: any): any {
    const output = { ...target };

    if ((isObject(target) && isObject(source)) || (target === undefined && isObject(source))) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  const mergedConfig = mergeDeep(defaultConfig, userConfig);
  return mergedConfig as T;
}
