import path from 'path';
import consola from 'consola';
import { type I_ConfigLoader } from '../ConfigLoader';
import { TYPES } from '../types';
import { absoluteGuard } from '../file';
import { FilePath } from '../typeDefs';
import type { I_FileSystem } from '../FileSystem';
import { inject } from 'inversify';

export class I18n implements I18n {
  constructor(
    @inject(TYPES.FileSystem) private readonly fs: I_FileSystem,
    @inject(TYPES.ConfigLoader) private readonly configLoader: I_ConfigLoader,
  ) {}

  /**
   * Get all messages each language in a locale dir in the project.
   * @param key
   * @returns All messages each language.
   */
  public async geti18nMessages(key: string) {
    const result: I18nMessages = { en: key };
    const match = key.match(/__MSG_(.*)__/);

    if (match !== null) {
      const i18nKey = match[1];
      const localesPath = this.getlocalesPath();

      if (await this.fs.exists(localesPath)) {
        const langKeys = await this.getEnableLangs(localesPath);

        await Promise.all(
          langKeys.map(async (langKey) => {
            const msg = await this.getMessage(langKey, i18nKey);
            if (msg !== null) {
              result[langKey] = msg;
            }
          }),
        );
      }
    }

    return result;
  }

  /**
   * Get a message in a locale dir in the project.
   * @param key
   * @returns A message
   */
  public async getMessage(langKey: string, key: string) {
    const localesPath = this.getlocalesPath();
    const messagesJsonPath = absoluteGuard(path.resolve(localesPath, langKey, 'messages.json'));

    const data = await this.fs.readFile(messagesJsonPath, { encoding: 'utf-8' });

    const messagesJson: Record<string, { message: string }> = JSON.parse(data);

    const message = messagesJson[key].message;

    if (message !== undefined) {
      return message;
    } else {
      return null;
    }
  }

  /**
   * Get exist languages in a locale dir in the project.
   * @param localesPath
   * @returns Exist languages in a locale dir in the project.
   */
  private async getEnableLangs(localesPath: FilePath<'absolute'>) {
    const langs = await this.fs.readdir(localesPath);

    if (!langs.includes('en')) {
      throw consola.error(new Error('There is no en directory in the _locales directory.'));
    }

    return langs;
  }

  public getlocalesPath() {
    const config = this.configLoader.useConfig();

    const dir = path.dirname(config.manifest);

    return absoluteGuard(path.resolve(dir, '_locales'));
  }

  /**
   * Output locales file to dist.
   */
  public async copyLocales() {
    const localesPath = this.getlocalesPath();
    const config = this.configLoader.useConfig();

    if ((await this.fs.exists(localesPath)) && config.output.chrome !== undefined) {
      await this.fs.copy(localesPath, path.join(config.output.chrome, '_locales'));
    }
  }
}

export type I18nMessages = Record<string, string>;

export interface I_I18n {
  geti18nMessages(key: string): Promise<I18nMessages>;

  getMessage(langKey: string, key: string): Promise<string | null>;

  getlocalesPath(): string;

  copyLocales(): Promise<void>;
}
