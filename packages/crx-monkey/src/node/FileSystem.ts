import { injectable } from 'inversify';
import fse from 'fs-extra';
import { FilePath } from './typeDefs';
import path from 'path';
import { resolveFilePath } from './file';
import esbuild from 'esbuild';
import mime from 'mime';

@injectable()
export class FileSystem implements I_FileSystem {
  public async exists(path: string): Promise<boolean> {
    return await fse.exists(path);
  }

  public existsSync(path: string): boolean {
    return fse.existsSync(path);
  }

  public readFile = fse.readFile;
  public readFileSync = fse.readFileSync;

  public writeFile = fse.writeFile;
  public writeFileSync = fse.writeFileSync;

  public readdir = fse.readdir;
  public readdirSync = fse.readdirSync;

  public remove = fse.remove;
  public removeSync = fse.removeSync;

  public copy = fse.copy;
  public copySync = fse.copySync;

  public outputFile = fse.outputFile;
  public outputFileSync = fse.outputFileSync;

  public watch = fse.watch;
  public promises = fse.promises;

  /**
   * Import a JS or TS dynamically without any cache.
   * @param filePath
   * @returns A module.
   */
  public async noCacheImport<T = unknown>(
    filePath: FilePath,
    base: FilePath = import.meta.dirname as FilePath<'absolute'>,
  ) {
    if (!(await this.exists(filePath))) {
      throw new Error(`The module '${filePath}' does not exist`);
    }

    /**
     * Is this file typescript?
     * @param filepath
     * @returns
     */
    function isTs(filepath: FilePath) {
      const s = filepath.split('.');
      return s[s.length - 1] === 'ts' ? true : false;
    }

    let tmpFilePath: string;

    if (isTs(filePath)) {
      const buildResult = await esbuild
        .build({
          entryPoints: [filePath],
          write: false,
          platform: 'node',
          bundle: true,
          target: 'esnext',
          format: 'esm',
          external: [
            'fs',
            'path',
            '../packages/crx-monkey/dist/node/exports.js',
            'crx-monkey',
            'crx-monkey-next',
          ],
        })
        .then((result) => {
          const outputFile = result.outputFiles[0];
          return outputFile.contents;
        });

      tmpFilePath = path.resolve(base, crypto.randomUUID()) as FilePath<'absolute'>;

      await this.outputFile(tmpFilePath, buildResult);
    } else {
      const data = await this.readFile(filePath);
      tmpFilePath = path.resolve(base, crypto.randomUUID()) as FilePath<'absolute'>;

      await this.outputFile(tmpFilePath, data.toString());
    }

    try {
      const module = (await import(resolveFilePath(tmpFilePath, true))) as T;
      await this.remove(tmpFilePath);
      return module;
    } catch (e) {
      await this.remove(tmpFilePath);
      throw e;
    }
  }

  public async fileToDataUri(filePath: FilePath) {
    const mimeType = mime.getType(filePath) || 'application/octet-stream';
    const buffer = await this.readFile(filePath);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}

export interface I_FileSystem {
  // --- Basic Check ---
  exists(path: string): Promise<boolean>;
  existsSync(path: string): boolean;

  // --- Read ---
  readFile: typeof fse.readFile.__promisify__ & typeof fse.readFile;
  readFileSync: typeof fse.readFileSync;

  // --- Readdir ---
  readdir: typeof fse.readdir.__promisify__ & typeof fse.readdir;
  readdirSync: typeof fse.readdirSync;

  // --- Write ---
  writeFile: typeof fse.writeFile.__promisify__ & typeof fse.writeFile;
  writeFileSync: typeof fse.writeFileSync;

  // --- Remove ---
  remove: typeof fse.remove; // fs-extra の remove は既に Promise を返す
  removeSync: typeof fse.removeSync;

  // --- Copy ---
  copy: typeof fse.copy;
  copySync: typeof fse.copySync;

  // --- Output (Ensure directory exists) ---
  outputFile: typeof fse.outputFile;
  outputFileSync: typeof fse.outputFileSync;

  // --- Custom Methods ---
  noCacheImport<T = unknown>(filePath: FilePath, base: FilePath): Promise<T>;
  fileToDataUri(filePath: FilePath): Promise<string>;

  // --- Watch & Sub-modules ---
  watch: typeof fse.watch;
  promises: typeof fse.promises;
}
