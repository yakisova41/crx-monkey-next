import fsExtra from 'fs-extra/esm';
import fs from 'fs';
import path from 'path';
import consola from 'consola';
import { container } from '../inversify.config';
import { ConfigLoader } from '../ConfigLoader';
import { TYPES } from '../types';

/**
 * Get all messages each language in a locale dir in the project.
 * @param key
 * @returns All messages each language.
 */
export async function geti18nMessages(key: string) {
  const result: Record<string, string> = { en: key };
  const match = key.match(/__MSG_(.*)__/);

  if (match !== null) {
    const i18nKey = match[1];
    const localesPath = getlocalesPath();

    if (fsExtra.pathExistsSync(localesPath)) {
      const langKeys = getEnableLangs(localesPath);

      await Promise.all(
        langKeys.map(async (langKey) => {
          const msg = await getMessage(langKey, i18nKey);
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
export async function getMessage(langKey: string, key: string) {
  const localesPath = getlocalesPath();
  const messagesJsonPath = path.resolve(localesPath, langKey, 'messages.json');

  const messagesJson: Record<string, { message: string }> =
    await fsExtra.readJSON(messagesJsonPath);

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
export function getEnableLangs(localesPath: string) {
  const langs = fs.readdirSync(localesPath);

  if (!langs.includes('en')) {
    throw consola.error(new Error('There is no en directory in the _locales directory.'));
  }

  return langs;
}

export function getlocalesPath() {
  const config = container.get<ConfigLoader>(TYPES.ConfigLoader).useConfig();

  const dir = path.dirname(config.manifest);

  return path.resolve(dir, '_locales');
}

/**
 * Copy a locales dir in the src to dist in the project.
 */
export async function copyLocales() {
  const localesPath = getlocalesPath();
  const config = container.get<ConfigLoader>(TYPES.ConfigLoader).useConfig();

  if ((await fsExtra.pathExists(localesPath)) && config.output.chrome !== undefined) {
    await fsExtra.copy(localesPath, path.join(config.output.chrome, '_locales'));
  }
}
