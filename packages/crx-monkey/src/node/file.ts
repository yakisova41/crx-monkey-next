import path from 'path';
import { fileURLToPath } from 'url';
import { FilePath } from './typeDefs';

export type FileURL = `file:///${string}`;

/**
 * If user used windows, path scheme would be changed file:// and absolutable.
 * @param filePath
 * @returns
 */
export function resolveFilePath(filePath: string, url: boolean = false) {
  if (process.env.OS === 'Windows_NT') {
    if (path.isAbsolute(filePath)) {
      const resolved = path.resolve(filePath).replaceAll('\\', '/');
      if (url) {
        return ('file:///' + resolved) as FilePath<'absolute'>;
      }
      return fileURLToPath('file:///' + resolved) as FilePath<'absolute'>;
    } else {
      const resolved = path.resolve(__dirname, filePath).replaceAll('\\', '/');
      if (url) {
        return ('file:///' + resolved) as FilePath<'absolute'>;
      }
      return fileURLToPath('file:///' + resolved) as FilePath<'absolute'>;
    }
  } else {
    return path.resolve(filePath) as FilePath<'absolute'>;
  }
}

/**
 * This is a type guard that ensures that file path strings are absolute.
 * We recommend wrapping functions such as path.resolve and using them.
 * @param filePath
 * @returns
 */
export function absoluteGuard(filePath: string | FilePath) {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`The filepath "${filePath} is not absolute."`);
  }

  return filePath as FilePath<'absolute'>;
}
