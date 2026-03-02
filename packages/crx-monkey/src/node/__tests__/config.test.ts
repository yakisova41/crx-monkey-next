import { mkdtempSync, writeFileSync, rmdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { ConfigLoader } from '../ConfigLoader';
import { defineConfig, sassBundler, sassBundlerWatch, tsBundler, tsBundlerWatch } from '../exports';
import { mock, expect, it, describe, spyOn, afterEach, beforeEach } from 'bun:test';
import { htmlBundler, htmlBundlerWatch } from '../plugins/htmlBundler';
import { CrxmConfigRequired } from '../typeDefs';

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
    '^.*.(ts|js|tsx|jsx)$': tsBundler({}),
    '^.*.(css|sass|scss)$': sassBundler(),
    '^.*.(html|htm)$': htmlBundler(),
  },
  watch: {
    '^.*.(ts|js|tsx|jsx)$': tsBundlerWatch({
      esbuild: {
        sourcemap: 'inline',
      },
    }),
    '^.*.(css|sass|scss)$': sassBundlerWatch(),
    '^.*.(html|htm)$': htmlBundlerWatch(),
  },
  logLevel: 'error',
  public: false,
  define: {
    sw: {},
    contentscripts: {},
    popup: {},
  },
  popup_in_userscript: false,
};

const EXPORTS_PATH = resolve(import.meta.dir, '../exports');

describe('A config can be imported.', () => {
  afterEach(() => {
    mock.restore();
    if (existsSync(join(tmpdir(), 'test-'))) {
      rmdirSync(join(tmpdir(), 'test-'));
    }
  });

  let testDir: string;
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'test-'));
    spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  it('crxm.config.js can be loaded.', async () => {
    const config = defineConfig({});

    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export default defineConfig({});`,
    );

    const loader = new ConfigLoader();
    await loader.loadConfig();

    const use = loader.useConfig();

    expect(JSON.stringify(use)).toBe(JSON.stringify(config));
  });

  it('crxm.config.ts can be loaded.', async () => {
    writeFileSync(
      join(testDir, 'crxm.config.ts'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export default defineConfig({});`,
    );

    const loader = new ConfigLoader();
    await loader.loadConfig();

    const use = loader.useConfig();

    expect(JSON.stringify(use)).toBe(JSON.stringify(defaultConfig));
  });

  it('should not cache the module on subsequent imports.', async () => {
    const config = defineConfig({
      logLevel: 'error',
    });

    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export default defineConfig({
      logLevel: "info"
    });`,
    );

    const loader = new ConfigLoader();
    await loader.loadConfig();

    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export default defineConfig({
      logLevel: "error"
    });`,
    );

    await loader.loadConfig();

    const use = loader.useConfig();

    expect(JSON.stringify(use)).toBe(JSON.stringify(config));
  });
});

describe('Errors when failing to load config', () => {
  afterEach(() => {
    mock.restore();
    if (existsSync(join(tmpdir(), 'test-'))) {
      rmdirSync(join(tmpdir(), 'test-'));
    }
  });

  let testDir: string;
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'test-'));
    spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  it('should throw an error when nothing is exported', async () => {
    writeFileSync(join(testDir, 'crxm.config.js'), ``);

    const loader = new ConfigLoader();

    await expect(loader.loadConfig()).rejects.toThrow('The config is not exported as default in');
  });

  it('should throw an error when default export is missing', async () => {
    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export const config =  defineConfig({});`,
    );

    const loader = new ConfigLoader();

    await expect(loader.loadConfig()).rejects.toThrow('The config is not exported as default in');
  });

  it('should throw an error if the config file does not exist', async () => {
    const loader = new ConfigLoader();

    await expect(loader.loadConfig()).rejects.toThrow(
      'The config file not found. Please create "crxm.config.js"',
    );
  });
});

describe('Config object integrity', () => {
  describe('Plugin merging in build', () => {
    describe('when adding a plugin with a new key', () => {
      it('should add the new plugin while preserving the default plugins', async () => {
        expect(
          JSON.stringify(
            defineConfig({
              build: {
                'new key': tsBundler(),
              },
            }).build,
          ),
        ).toBe(
          JSON.stringify({
            ...defaultConfig.build,
            'new key': { name: 'Crxm Typescript Plugin' },
          }),
        );
      });
    });

    describe('when providing a plugin with an existing key', () => {
      it('should correctly merge or override the existing plugin configuration', async () => {
        expect(
          JSON.stringify(
            defineConfig({
              build: {
                [Object.keys(defineConfig({}).build)[0]]: tsBundler(),
              },
            }).build,
          ),
        ).toBe(
          JSON.stringify({
            ...defaultConfig.build,
            [Object.keys(defaultConfig.build)[0]]: { name: 'Crxm Typescript Plugin' },
          }),
        );
      });
    });
  });

  describe('Plugin merging in watch', () => {
    describe('when adding a plugin with a new key', () => {
      it('should add the new plugin while preserving the default plugins', async () => {
        expect(
          JSON.stringify(
            defineConfig({
              watch: {
                'new key': tsBundlerWatch(),
              },
            }).watch,
          ),
        ).toBe(
          JSON.stringify({
            ...defaultConfig.watch,
            'new key': { name: 'Crxm Watch Typescript Plugin' },
          }),
        );
      });
    });

    describe('when providing a plugin with an existing key', () => {
      it('should correctly merge or override the existing plugin configuration', async () => {
        expect(
          JSON.stringify(
            defineConfig({
              watch: {
                [Object.keys(defaultConfig.watch)[0]]: tsBundlerWatch(),
              },
            }).watch,
          ),
        ).toBe(
          JSON.stringify({
            ...defaultConfig.watch,
            [Object.keys(defaultConfig.watch)[0]]: { name: 'Crxm Watch Typescript Plugin' },
          }),
        );
      });
    });
  });

  describe('Server and Output merging', () => {
    it('should preserve default hostname when the user only overrides the port in server settings', () => {
      const config = defineConfig({
        server: { port: 3000 },
      });
      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost'); // デフォルトが維持されているか
    });

    it('should preserve default output paths when the user only overrides partial output settings', () => {
      const config = defineConfig({
        output: { chrome: 'custom-dist' },
      });
      expect(config.output.chrome).toBe('custom-dist');
      expect(config.output.userjs).toBe(defaultConfig.output.userjs); // デフォルトが維持されているか
    });
  });

  describe('Default values and user overrides', () => {
    describe('logLevel', () => {
      it('should be "error" by default', () => {
        expect(defineConfig({}).logLevel).toBe('error');
      });
      it('should be overridden by user provided value', () => {
        expect(defineConfig({ logLevel: 'debug' }).logLevel).toBe('debug');
      });
    });

    describe('public', () => {
      it('should be false by default', () => {
        expect(defineConfig({}).public).toBe(false);
      });
      it('should be overridden by user provided value', () => {
        expect(defineConfig({ public: '/' }).public).toBe('/');
      });
    });

    describe('popup_in_userscript', () => {
      it('should be false by default', () => {
        expect(defineConfig({}).popup_in_userscript).toBe(false);
      });
      it('should be changed to true when specified by the user', () => {
        expect(defineConfig({ popup_in_userscript: true }).popup_in_userscript).toBe(true);
      });
    });

    describe('manifest', () => {
      it('should default to "manifest.js"', () => {
        expect(defineConfig({}).manifest).toBe('manifest.js');
      });
      it('should be overridden by user provided filename', () => {
        expect(defineConfig({ manifest: 'usermanifest' }).manifest).toBe('usermanifest');
      });
    });
  });
});
