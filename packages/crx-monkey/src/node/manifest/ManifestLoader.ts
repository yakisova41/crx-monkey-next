import { CrxmManifestImportantKeyRequired } from 'src/node/typeDefs';
import { noCacheImport, resolveFilePath } from '../file';
import { resolve, dirname } from 'path';
import { inject, injectable } from 'inversify';
import type { I_ConfigLoader } from '../ConfigLoader';
import { TYPES } from '../types';
import { exists } from 'fs-extra';

export interface I_ManifestLoader {
  loadManifest(): Promise<void>;
  useManifest(): CrxmManifestImportantKeyRequired;
}

/**
 * Load and store the manifest from project.
 */
@injectable()
export class ManifestLoader implements I_ManifestLoader {
  private loadedManifest: null | CrxmManifestImportantKeyRequired = null;
  public readonly manifestPath: string;

  constructor(@inject(TYPES.ConfigLoader) private readonly configLoader: I_ConfigLoader) {
    // Get manifest file path.
    const config = this.configLoader.useConfig();
    const confPath = this.configLoader.useConfigPath();
    const projectDir = dirname(confPath);
    this.manifestPath = resolve(projectDir, config.manifest);
  }

  /**
   * Load manifest from project.
   * @param manifestPath
   */
  public async loadManifest() {
    // Get manfest path\
    const resolvedManifestPath = resolveFilePath(this.manifestPath);

    if (!await exists(resolvedManifestPath)) {
      throw new Error(`The manifest does not exist "${this.manifestPath}".`);
    }

    await noCacheImport<{ default: CrxmManifestImportantKeyRequired }>(resolvedManifestPath, dirname(resolvedManifestPath)).then(
      (manifest) => {
        const exportedManifest = manifest.default as CrxmManifestImportantKeyRequired;

        if (exportedManifest === undefined) {
          throw new Error(`The manifest is not exported as default in "${this.manifestPath}".`);
        }

        if (exportedManifest === undefined) {
          throw new Error(`The manifest is not exported as default in "${this.manifestPath}".`);
        }
        this.loadedManifest = exportedManifest;
      },
    );
  }

  /**
   * Use manifest loaded.
   * @returns
   */
  public useManifest() {
    if (this.loadedManifest === null) {
      throw new Error(
        'The manifest has never been loaded, please loadManifest() before using manifest.',
      );
    }

    return this.loadedManifest;
  }
}
