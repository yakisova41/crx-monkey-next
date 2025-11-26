import path from 'path';
import fse, { exists } from 'fs-extra';
import crypto from 'crypto';

/**
 * If user used windows, path scheme would be changed file:// and absolutable.
 * @param filePath
 * @returns
 */
export function resolveFilePath(filePath: string) {
  if (process.env.OS === 'Windows_NT') {
    if (path.isAbsolute(filePath)) {
      const resolved = path.resolve(filePath);
      return 'file://' + resolved;
    } else {
      const resolved = path.resolve(__dirname, filePath);
      return 'file://' + resolved;
    }
  } else {
    return filePath;
  }
}

/**
 * Import a JS dynamically without any cache.
 * @param filePath
 * @returns A module.
 */
export async function noCacheImport<T = unknown>(filePath: string, base: string = './') {
  if (!exists(filePath)) {
    throw new Error(`The module '${filePath}' does not exist`);
  }
  const data = fse.readFileSync(filePath, {});
  const tmpFilePath = path.resolve(base, crypto.randomUUID());
  await fse.outputFile(tmpFilePath, data.toString());

  try {
    const module = (await import(tmpFilePath)) as T;
    fse.removeSync(tmpFilePath);
    return module;
  } catch (e) {
    fse.removeSync(tmpFilePath);
    throw e;
  }
}
