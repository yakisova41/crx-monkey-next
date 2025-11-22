import { promises } from 'fs';
import { noCacheImport, resolveFilePath } from './file';
import { CrxmConfigRequired } from 'src/client/typeDefs';
import { injectable } from 'inversify';

export interface I_ConfigLoader {
  loadConfig(): Promise<void>;
  useConfig(): CrxmConfigRequired;
  useConfigPath(): string;
}

/**
 * Load and store the config from project.
 */
@injectable()
export class ConfigLoader implements I_ConfigLoader {
  public static configFileNamePatterns = ['crxm.config.js'];
  private loadedConfig: CrxmConfigRequired | null = null;
  private configPath: string | null = null;

  /**
   * Load config from project
   */
  public async loadConfig() {
    await this.searchConfig()
      .then(async (confPath) => {
        await this.loadConfigDetail(confPath);
      })
      .catch((e) => {
        throw e;
      });
  }

  /**
   * Use config loaded.
   */
  public useConfig(): CrxmConfigRequired {
    if (this.loadedConfig === null) {
      throw new Error('The config has never been loaded, please loadConfig() before using.');
    }

    return this.loadedConfig;
  }

  /**
   * Get loaded config path.
   */
  public useConfigPath() {
    if (this.configPath === null) {
      throw new Error(
        'The config has never been loaded, please loadConfig() before using config path.',
      );
    }

    return this.configPath;
  }

  /**
   * Get the path of config file deeply.
   * @returns
   */
  private async searchConfig(): Promise<string> {
    return await new Promise((resolve, reject) => {
      let dir = process.cwd();

      const searchThen = (result: string | null): void => {
        if (result !== null) {
          resolve(dir + '/' + result);
        } else {
          const splited = dir.split('/');
          if (splited.length === 1) {
            reject(new Error('The config file not found. Please create "crxm.config.js"'));
          } else {
            splited.pop();
            dir = splited.join('/');
            void this.configSearchInDir(dir).then(searchThen);
          }
        }
      };

      void this.configSearchInDir(dir).then(searchThen);
    });
  }

  /**
   * Get the path of config file from directory.
   * @returns
   */
  private async configSearchInDir(dir: string): Promise<string | null> {
    return await new Promise((resolve) => {
      void promises.readdir(dir + '/').then((files) => {
        files.forEach((fileName) => {
          ConfigLoader.configFileNamePatterns.forEach((fileNamePattern) => {
            if (fileName === fileNamePattern) {
              resolve(fileName);
            }
          });
        });

        resolve(null);
      });
    });
  }

  /**
   * Import config file then set to value.
   * @param confPath
   */
  private async loadConfigDetail(confPath: string) {
    const configAbsolutePath = resolveFilePath(confPath);

    await noCacheImport<{ default: CrxmConfigRequired }>(configAbsolutePath)
      .then((buildConfig) => {
        const exportedConfig = buildConfig.default as CrxmConfigRequired;

        if (exportedConfig === undefined) {
          throw new Error(`The config is not exported as default in "${configAbsolutePath}".`);
        }

        if (exportedConfig === undefined) {
          throw new Error(`The config is not exported as default in "${configAbsolutePath}".`);
        }

        this.loadedConfig = exportedConfig;
        this.configPath = confPath;
      })
      .catch((e) => {
        throw new Error(e);
      });
  }
}
