import path from 'path';
import fse, { exists } from 'fs-extra';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mime from 'mime';

export type FileURL = `file:///${string}`;
export type FilePath = string;

/**
 * If user used windows, path scheme would be changed file:// and absolutable.
 * @param filePath
 * @returns
 */
export function resolveFilePath(filePath: string, url: boolean = false): FileURL | FilePath {
  if (process.env.OS === 'Windows_NT') {
    if (path.isAbsolute(filePath)) {
      const resolved = path.resolve(filePath).replaceAll('\\', '/');
      if (url) {
        return 'file:///' + resolved;
      }
      return fileURLToPath('file:///' + resolved);
    } else {
      const resolved = path.resolve(__dirname, filePath).replaceAll('\\', '/');
      if (url) {
        return 'file:///' + resolved;
      }
      return fileURLToPath('file:///' + resolved);
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
export async function noCacheImport<T = unknown>(
  filePath: FilePath,
  base: FilePath = import.meta.dirname,
) {
  if (!(await exists(filePath))) {
    throw new Error(`The module '${filePath}' does not exist`);
  }
  const data = fse.readFileSync(filePath, {});
  const tmpFilePath = path.resolve(base, crypto.randomUUID());

  await fse.outputFile(tmpFilePath, data.toString());

  try {
    const module = (await import(resolveFilePath(tmpFilePath, true))) as T;
    fse.removeSync(tmpFilePath);
    return module;
  } catch (e) {
    fse.removeSync(tmpFilePath);
    throw e;
  }
}

export function fileToDataUri(filePath: string) {
  const mimeType = mime.getType(filePath) || 'application/octet-stream';
  const buffer = fse.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
