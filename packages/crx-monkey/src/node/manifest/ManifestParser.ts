import { inject, injectable } from 'inversify';
import { CrxmManifestImportantKeyRequired } from 'src/client/typeDefs';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';
import { dirname, resolve } from 'path';

export interface I_ManifestParser {
  parse(manifest: CrxmManifestImportantKeyRequired): ParseResult | null;
  parseResult: ParseResult;
}

@injectable()
export class ManifestParser implements I_ManifestParser {
  private _parseResult: null | ParseResult = null;

  constructor(@inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader) {}

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
    };

    return this._parseResult;
  }

  private getAllIcons(manifest: CrxmManifestImportantKeyRequired) {
    const icons = manifest.icons;
    if (icons === undefined) {
      return null;
    } else {
      const result: Record<
        number,
        {
          raw: string;
          path: string;
          size: number;
        }
      > = {};
      Object.keys(icons).map((size) => {
        const sizeN = size as unknown as number;
        const filePathRelative = icons[sizeN];

        const absolute = resolve(filePathRelative);

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
    const confPath = this.configLoader.useConfigPath();
    const projectDir = dirname(confPath);

    const sw: string[] = [];
    const contentResources: string[] = [];
    const cssResources: string[] = [];

    const swRaw: string[] = [];
    const contentResourcesRaw: string[] = [];
    const cssResourcesRaw: string[] = [];

    const popupHtml: string[] = [];
    const popupHtmlRaw: string[] = [];

    if (manifest?.background?.service_worker !== undefined) {
      swRaw.push(manifest.background.service_worker);
      sw.push(resolve(projectDir, manifest.background.service_worker));
    }

    if (manifest?.action?.default_popup !== undefined) {
      popupHtmlRaw.push(manifest.action.default_popup);
      popupHtml.push(resolve(projectDir, manifest.action.default_popup));
    }

    manifest.content_scripts.forEach(({ js, css }) => {
      contentResources.push(
        ...js.map((p) => {
          contentResourcesRaw.push(p);
          return resolve(projectDir, p);
        }),
      );
      cssResources.push(
        ...css.map((p) => {
          cssResourcesRaw.push(p);
          return resolve(projectDir, p);
        }),
      );
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
    sw: string[];
    content: string[];
  };
  /**
   * Absolute file paths of all style source.
   */
  cssResources: string[];
  /**
   * html
   */
  htmlResources: { popup: string[] };
  /**
   * Raw file path written in manifest
   */
  raw: {
    /**
     * Raw file paths of all script source source written in manifest
     */
    scriptResources: {
      sw: string[];
      content: string[];
    };
    /**
     * Raw file paths of all style source written in manifest
     */
    cssResources: string[];
    /**
     * html
     */
    htmlResources: { popup: string[] };
  };
};

export type ParseResult = {
  resources: Resources;
  icons: Record<
    number,
    {
      raw: string;
      path: string;
      size: number;
    }
  > | null;
};
