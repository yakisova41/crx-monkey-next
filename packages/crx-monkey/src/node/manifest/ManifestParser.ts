import { inject, injectable } from 'inversify';
import { CrxmManifestImportantKeyRequired, FilePath } from 'src/node/typeDefs';
import { TYPES } from '../types';
import type { I_ConfigLoader } from '../ConfigLoader';
import { dirname, resolve } from 'path';
import { absoluteGuard } from '../file';

export interface I_ManifestParser {
  parse(manifest: CrxmManifestImportantKeyRequired): ParseResult | null;
  parseResult: ParseResult;
}

@injectable()
export class ManifestParser implements I_ManifestParser {
  private _parseResult: null | ParseResult = null;

  constructor(@inject(TYPES.ConfigLoader) private readonly configLoader: I_ConfigLoader) {}

  public get parseResult() {
    if (this._parseResult === null) {
      throw new Error(
        'The manifest has never been parsed. Plaese parse your manifest before getting a result.',
      );
    }

    return this._parseResult;
  }

  /**
   * Get all resources written in manifest.
   * @param manifest
   * @returns
   */
  public parse(manifest: CrxmManifestImportantKeyRequired) {
    this._parseResult = {
      resources: this.getAllResources(manifest),
      icons: this.getAllIcons(manifest),
      isUsingTrustedScripts: this.isUseTrusted(manifest),
    };

    return this._parseResult;
  }

  private isUseTrusted(manifest: CrxmManifestImportantKeyRequired) {
    let is = false;
    manifest.content_scripts.forEach(({ trusted_inject }) => {
      if (trusted_inject) {
        is = true;
      }
    });
    return is;
  }

  private getAllIcons(manifest: CrxmManifestImportantKeyRequired) {
    const icons = manifest.icons;
    if (icons === undefined) {
      return null;
    } else {
      const result: Record<
        number,
        {
          raw: FilePath<'absolute' | 'relative'>;
          path: FilePath<'absolute'>;
          size: number;
        }
      > = {};
      Object.keys(icons).map((size) => {
        const sizeN = size as unknown as number;
        const filePathRelative = icons[sizeN] as FilePath;

        const absolute = absoluteGuard(resolve(filePathRelative));

        result[sizeN] = {
          raw: filePathRelative,
          path: absolute,
          size: sizeN,
        };
      });
      return result;
    }
  }

  /**
   * Get all typescript and css filenames which are written in 'manifest.js' in project.
   * @param manifest
   * @returns
   */
  private getAllResources(manifest: CrxmManifestImportantKeyRequired): Resources {
    const confPath: FilePath<'absolute'> = this.configLoader.useConfigPath();
    const projectDir = absoluteGuard(dirname(confPath));

    const sw: FilePath<'absolute'>[] = [];
    const contentResources: FilePath<'absolute'>[] = [];
    const cssResources: FilePath<'absolute'>[] = [];
    const popupHtml: FilePath<'absolute'>[] = [];

    const swRaw: FilePath<'relative' | 'absolute'>[] = [];
    const contentResourcesRaw: FilePath<'relative' | 'absolute'>[] = [];
    const cssResourcesRaw: FilePath<'relative' | 'absolute'>[] = [];
    const popupHtmlRaw: FilePath<'relative' | 'absolute'>[] = [];

    if (manifest?.background?.service_worker !== undefined) {
      swRaw.push(manifest.background.service_worker as FilePath);
      sw.push(absoluteGuard(resolve(projectDir, manifest.background.service_worker)));
    }

    if (manifest?.action?.default_popup !== undefined) {
      popupHtmlRaw.push(manifest.action.default_popup as FilePath);
      popupHtml.push(absoluteGuard(resolve(projectDir, manifest.action.default_popup)));
    }

    manifest.content_scripts.forEach(({ js, css }) => {
      if (js !== undefined) {
        js.map((p) => {
          const path = p as FilePath;
          if (!contentResourcesRaw.includes(path)) {
            contentResourcesRaw.push(path);
            contentResources.push(absoluteGuard(resolve(projectDir, path)));
          }
        });
      }
      if (css !== undefined) {
        css.map((p) => {
          const path = p as FilePath;

          if (!cssResourcesRaw.includes(path)) {
            cssResourcesRaw.push(path);
            cssResources.push(absoluteGuard(resolve(projectDir, p)));
          }
        });
      }
    });

    return {
      scriptResources: {
        sw: sw,
        content: contentResources,
      },
      cssResources,
      htmlResources: {
        popup: popupHtml,
      },
      raw: {
        scriptResources: {
          sw: swRaw,
          content: contentResourcesRaw,
        },
        cssResources: cssResourcesRaw,
        htmlResources: {
          popup: popupHtmlRaw,
        },
      },
    };
  }
}

export type Resources = {
  /**
   * Absolute file paths of all script source.
   */
  scriptResources: {
    sw: FilePath<'absolute'>[];
    content: FilePath<'absolute'>[];
  };
  /**
   * Absolute file paths of all style source.
   */
  cssResources: FilePath<'absolute'>[];
  /**
   * html
   */
  htmlResources: { popup: FilePath<'absolute'>[] };
  /**
   * Raw file path written in manifest
   */
  raw: {
    /**
     * Raw file paths of all script source source written in manifest
     */
    scriptResources: {
      sw: FilePath<'absolute' | 'relative'>[];
      content: FilePath<'absolute' | 'relative'>[];
    };
    /**
     * Raw file paths of all style source written in manifest
     */
    cssResources: FilePath<'absolute' | 'relative'>[];
    /**
     * html
     */
    htmlResources: { popup: FilePath<'absolute' | 'relative'>[] };
  };
};

export type ParseResult = {
  resources: Resources;
  icons: Record<
    number,
    {
      raw: FilePath<'absolute' | 'relative'>;
      path: FilePath<'absolute'>;
      size: number;
    }
  > | null;
  isUsingTrustedScripts: boolean;
};
