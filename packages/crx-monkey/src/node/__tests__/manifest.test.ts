import * as fs from 'fs'; // ★変更: fs全体をimport
import { I_ConfigLoader } from '../ConfigLoader';
import { ManifestLoader } from '../manifest/ManifestLoader';
import { noCacheImport } from '../file';
import { ManifestParser } from '../manifest/ManifestParser';
import { CrxmContentScript, CrxmManifestImportantKeyRequired } from '../typeDefs';

// --- モック定義 (トップレベルで定義) ---

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomUUID: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000000'),
  };
});

jest.mock('fs', () => {
  return {
    promises: {
      readdir: jest.fn(),
    },
    existsSync: jest.fn(),
  };
});

jest.mock('../file', () => ({
  noCacheImport: jest.fn(),
  resolveFilePath: jest.fn((p) => '/test/root/' + p),
}));

const mockConfigLoader: jest.Mocked<I_ConfigLoader> = {
  useConfig: jest.fn().mockReturnValue({
    manifest: 'manifest.js',
  }),
  useConfigPath: jest.fn().mockReturnValue('/test/root/crxm.config.js'),
  loadConfig: jest.fn(),
};

describe('Manifest Loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Throw an error if used before the manifest loaded.', () => {
    const loader = new ManifestLoader(mockConfigLoader);

    expect(() => loader.useManifest()).toThrow(
      'The manifest has never been loaded, please loadManifest() before using manifest.',
    );
  });

  test('Throw an error if the manifest does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    const loader = new ManifestLoader(mockConfigLoader);

    await expect(loader.loadManifest()).rejects.toThrow(/^The manifest does not exist/);
  });

  test('Throw an error if the manifest does not export any modules', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    (noCacheImport as jest.Mock).mockResolvedValue({});

    const loader = new ManifestLoader(mockConfigLoader);

    await expect(loader.loadManifest()).rejects.toThrow(
      /^The manifest is not exported as default in /,
    );
  });

  test('Throw an error if the manifest does not export default modules but export named', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    (noCacheImport as jest.Mock).mockResolvedValue({
      named: {},
    });

    const loader = new ManifestLoader(mockConfigLoader);

    await expect(loader.loadManifest()).rejects.toThrow(
      /^The manifest is not exported as default in /,
    );
  });

  test('Load manifest from default exported module.', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: {},
    });

    const loader = new ManifestLoader(mockConfigLoader);

    await expect(loader.loadManifest()).resolves.toBe(undefined);
  });

  test('Is it the same as what is loaded when using manifest?', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const manifest = { aaaaaa: 'aaaaaaa' };

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: manifest,
    });

    const loader = new ManifestLoader(mockConfigLoader);
    await loader.loadManifest();

    expect(loader.useManifest()).toBe(manifest);
  });

  test('After modifying the file, it can load the changes.', async () => {
    const manifest1 = {
      aaaa: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    };
    const manifest2 = {
      aaaa: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: manifest1,
    });

    const loader = new ManifestLoader(mockConfigLoader);
    await loader.loadManifest();

    expect(loader.useManifest()).toBe(manifest1);

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: manifest2,
    });

    await loader.loadManifest();

    expect(loader.useManifest()).toBe(manifest2);
  });
});

const baseManifest: CrxmManifestImportantKeyRequired = {
  description: '',
  background: undefined,
  name: '',
  version: '',
  manifest_version: 3,
  action: undefined,
  icons: undefined,
  content_scripts: [],
};

type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};
const baseContent: DeepRequired<CrxmContentScript> = {
  js: [],
  matches: [],
  exclude_matches: [],
  css: [],
  run_at: 'document_start',
  all_frames: false,
  match_about_blank: false,
  include_globs: [],
  exclude_globs: [],
  world: 'ISOLATED',
  userscript_direct_inject: false,
  trusted_inject: false,
  use_isolated_connection: false,
};

describe('Manifest parser', () => {
  test('Parse manifest, a js in a content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          js: ['a.js'],
        },
      ],
    };

    const result = parser.parse(manifest);
    expect(result.resources.scriptResources).toStrictEqual({
      content: ['/test/root/a.js'],
      sw: [],
    });
  });

  test('Parse manifest, a separate js in each 2 content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          js: ['a.js'],
        },
        {
          ...baseContent,
          js: ['b.js'],
        },
      ],
    };

    const result = parser.parse(manifest);
    expect(result.resources.scriptResources).toStrictEqual({
      content: ['/test/root/a.js', '/test/root/b.js'],
      sw: [],
    });
  });

  test('Parse manifest, a css in a content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          css: ['a.css'],
        },
      ],
    };

    const result = parser.parse(manifest);
    expect(result.resources.cssResources).toStrictEqual(['/test/root/a.css']);
  });

  test('Parse manifest, a separate css in each 2 content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          css: ['a.css'],
        },
        {
          ...baseContent,
          css: ['b.css'],
        },
      ],
    };

    const result = parser.parse(manifest);
    expect(result.resources.cssResources).toStrictEqual(['/test/root/a.css', '/test/root/b.css']);
  });

  test('Parse manifest, same js in each 2 content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          js: ['a.js'],
        },
        {
          ...baseContent,
          js: ['a.js'],
        },
      ],
    };

    const result = parser.parse(manifest);
    expect(result.resources.scriptResources).toStrictEqual({
      content: ['/test/root/a.js'],
      sw: [],
    });
  });

  test('Parse manifest, same css in each 2 content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          css: ['a.css'],
        },
        {
          ...baseContent,
          css: ['a.css'],
        },
      ],
    };
    const result = parser.parse(manifest);
    expect(result.resources.cssResources).toStrictEqual(['/test/root/a.css']);
  });

  test('Parse manifest, same 2 js in a content_scripts', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      content_scripts: [
        {
          ...baseContent,
          js: ['a.js', 'a.js'],
        },
      ],
    };

    const result = parser.parse(manifest);
    expect(result.resources.scriptResources).toStrictEqual({
      content: ['/test/root/a.js'],
      sw: [],
    });
  });

  test('Parse manifest, included sw', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      background: {
        service_worker: 'sw.ts',
        type: 'module',
      },
    };

    const result = parser.parse(manifest);
    expect(result.resources.scriptResources).toStrictEqual({
      content: [],
      sw: ['/test/root/sw.ts'],
    });
  });

  test('Parse manifest, sw is undefined', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      background: undefined,
    };

    const result = parser.parse(manifest);
    expect(result.resources.scriptResources).toStrictEqual({
      content: [],
      sw: [],
    });
  });

  test('Parse manifest, included popup', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      action: {
        default_popup: 'a.html',
        default_icon: undefined,
      },
    };

    const result = parser.parse(manifest);
    expect(result.resources.htmlResources).toStrictEqual({ popup: ['/test/root/a.html'] });
  });

  test('Parse manifest, popup is undefined', () => {
    const parser = new ManifestParser(mockConfigLoader);

    const manifest: CrxmManifestImportantKeyRequired = {
      ...baseManifest,
      action: {
        default_popup: undefined,
        default_icon: undefined,
      },
    };

    const result = parser.parse(manifest);
    expect(result.resources.htmlResources).toStrictEqual({ popup: [] });
  });
});
