import { mkdtempSync, writeFileSync, rmdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { ConfigLoader } from '../ConfigLoader';
import { mock, expect, it, describe, spyOn, afterEach, beforeEach } from 'bun:test';
import { CrxmManifestImportantKeyRequired } from '../typeDefs';
import { ManifestLoader } from '../manifest/ManifestLoader';

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
const EXPORTS_PATH = resolve(import.meta.dir, '../exports');

describe('A manifest can be imported.', () => {
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

  it('manifest.js can be loaded.', async () => {
    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export default defineConfig({});`,
    );

    writeFileSync(
      join(testDir, 'manifest.js'),
      `
      import { defineManifest } from '${EXPORTS_PATH}';
      export default defineManifest({});`,
    );

    const configLoader = new ConfigLoader();
    await configLoader.loadConfig();

    const manifestLoader = new ManifestLoader(configLoader);
    await manifestLoader.loadManifest();

    const use = manifestLoader.useManifest();

    expect(JSON.stringify(use)).toBe(JSON.stringify(defaultManifest));
  });

  it('manifest.ts can be loaded.', async () => {
    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `
    import { defineConfig } from '${EXPORTS_PATH}';
    export default defineConfig({
        manifest: "./manifest.ts"
    });`,
    );

    writeFileSync(
      join(testDir, 'manifest.ts'),
      `
      import { defineManifest } from '${EXPORTS_PATH}';
      export default defineManifest({});`,
    );

    const configLoader = new ConfigLoader();
    await configLoader.loadConfig();

    const manifestLoader = new ManifestLoader(configLoader);
    await manifestLoader.loadManifest();

    const use = manifestLoader.useManifest();

    expect(JSON.stringify(use)).toBe(JSON.stringify(defaultManifest));
  });
});

describe('Errors when failing to load manifest', () => {
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

  it('should throw an error if the manifest file does not exist', async () => {
    // Configは存在するが、指定されたmanifest.jsが存在しない状態
    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `import { defineConfig } from '${EXPORTS_PATH}'; export default defineConfig({});`,
    );

    const configLoader = new ConfigLoader();
    await configLoader.loadConfig();

    const manifestLoader = new ManifestLoader(configLoader);

    await expect(manifestLoader.loadManifest()).rejects.toThrow('The manifest does not exist ');
  });

  it('should throw an error when default export is missing in manifest', async () => {
    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `import { defineConfig } from '${EXPORTS_PATH}'; export default defineConfig({});`,
    );

    // default exportがないマニフェストファイル
    writeFileSync(join(testDir, 'manifest.js'), `export const manifest = {};`);

    const configLoader = new ConfigLoader();
    await configLoader.loadConfig();

    const manifestLoader = new ManifestLoader(configLoader);
    await expect(manifestLoader.loadManifest()).rejects.toThrow(
      'The manifest is not exported as default in',
    );
  });
});

describe('Manifest and Config integration', () => {
  const EXPORTS_PATH = resolve(import.meta.dir, '../exports');

  let testDir: string;
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'test-'));
    spyOn(process, 'cwd').mockReturnValue(testDir);
  });

  afterEach(() => {
    mock.restore();
    if (existsSync(testDir)) {
      rmdirSync(testDir, { recursive: true });
    }
  });

  it('should load manifest from custom path specified in config', async () => {
    const customManifestName = 'custom.manifest.js';

    // Configでカスタムパスを指定
    writeFileSync(
      join(testDir, 'crxm.config.js'),
      `import { defineConfig } from '${EXPORTS_PATH}'; 
         export default defineConfig({ manifest: '${customManifestName}' });`,
    );

    // 指定されたカスタムパスにファイルを配置
    writeFileSync(
      join(testDir, customManifestName),
      `import { defineManifest } from '${EXPORTS_PATH}'; 
         export default defineManifest({ name: 'custom-name' });`,
    );

    const configLoader = new ConfigLoader();
    await configLoader.loadConfig();

    const manifestLoader = new ManifestLoader(configLoader);
    await manifestLoader.loadManifest();

    expect(manifestLoader.useManifest().name).toBe('custom-name');
  });
});
