import { resolve } from 'path';
import { ConfigLoader } from '../ConfigLoader';
import { promises } from 'fs';
import { noCacheImport } from '../file';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomUUID: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000000'),
  };
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      readdir: jest.fn(),
    },
  };
});

jest.mock('../file', () => ({
  noCacheImport: jest.fn(),
  resolveFilePath: jest.fn((p) => '/test/root/' + p),
}));

describe('Config loader', () => {
  beforeAll(() => {
    /**
     * Define mocked config
     */
    jest.mock(
      resolve('./', '00000000-0000-0000-0000-000000000000'),
      () => {
        return {
          default: undefined,
        };
      },
      { virtual: true },
    );
  });

  test('Throw an error if the config does not exist', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue([]);

    const loader = new ConfigLoader();
    await expect(loader.loadConfig()).rejects.toThrow(
      'The config file not found. Please create "crxm.config.js"',
    );
  });

  test('Throw an error if the config does not export any module', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    (noCacheImport as jest.Mock).mockResolvedValue({});

    const loader = new ConfigLoader();
    await expect(loader.loadConfig()).rejects.toThrow(/^The config is not exported as default in/);
  });

  test('Throw an error if the config does not export default module but export named.', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    (noCacheImport as jest.Mock).mockResolvedValue({
      named: 1,
    });

    const loader = new ConfigLoader();
    await expect(loader.loadConfig()).rejects.toThrow(/^The config is not exported as default in/);
  });

  test('Load when config is exported by default', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: 1,
    });

    const loader = new ConfigLoader();
    await expect(loader.loadConfig()).resolves.toBe(undefined);
  });

  test('The loaded config and the used config are the same', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    const config = {
      aaaa: 'bbdwesfjifeijweasoji',
    };

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: config,
    });

    const loader = new ConfigLoader();
    await loader.loadConfig();

    expect(loader.useConfig()).toBe(config);
  });

  test('After modifying the file, it can load the changes.', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    const config1 = {
      aaaa: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    };
    const config2 = {
      aaaa: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: config1,
    });

    const loader = new ConfigLoader();
    await loader.loadConfig();

    expect(loader.useConfig()).toBe(config1);

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: config2,
    });

    await loader.loadConfig();

    expect(loader.useConfig()).toBe(config2);
  });

  test('Throw an error if useConfig() before the config is loaded', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: {},
    });

    const loader = new ConfigLoader();

    expect(() => loader.useConfig()).toThrow(
      'The config has never been loaded, please loadConfig() before using.',
    );
  });

  test('Throw an error if useConfigPath() before the config is loaded', async () => {
    (promises.readdir as jest.Mock).mockResolvedValue(['crxm.config.js']);

    (noCacheImport as jest.Mock).mockResolvedValue({
      default: {},
    });

    const loader = new ConfigLoader();

    expect(() => loader.useConfigPath()).toThrow(
      'The config has never been loaded, please loadConfig() before using config path.',
    );
  });
});
