import { inject, injectable } from 'inversify';
import { getMessage } from './i18n';
import type { CrxmManifestImportantKeys } from 'src/client/typeDefs';
import { TYPES } from '../types';
import { ManifestLoader } from './ManifestLoader';

/**
 * Create post-build manifest from original manifest
 */
@injectable()
export class ManifestFactory {
  public rawManifest: CrxmManifestImportantKeys;
  private workspace: CrxmManifestImportantKeys;
  private definedCustomKeysByCrxMonkeyInContentScrpt: string[] = ['use_isolated_connection'];

  constructor(@inject(TYPES.ManifestLoader) private readonly manifestLoader: ManifestLoader) {
    this.rawManifest = this.manifestLoader.useManifest();
    this.workspace = structuredClone(this.rawManifest);
  }

  /**
   * Reload manifest from loader.
   */
  public initialize() {
    this.rawManifest = this.manifestLoader.useManifest();
    this.workspace = structuredClone(this.rawManifest);
  }

  /**
   * Extension Name -> [Dev] Extension Name
   */
  public enableDevMode() {
    const i18nNameMatch = this.workspace.name.match(/__MSG_(.*)__/);
    if (i18nNameMatch !== null) {
      getMessage('en', i18nNameMatch[1]).then((msg) => {
        if (msg !== null) {
          this.workspace.name = '[Dev] ' + msg;
        }
      });
    } else {
      this.workspace.name = '[Dev] ' + this.workspace.name;
    }
  }

  /**
   * Output the current manifest data.
   * @returns
   */
  public getWorkspace() {
    return this.absorbCustomKeys(this.workspace);
  }

  /**
   * Get manifest data absorbed defined custom keys by crx-monkey.
   * @returns
   */
  public getResult() {
    return this.absorbCustomKeys(this.workspace);
  }

  public resolve(sourcePath: string, targetPath: string) {
    // sw
    if (
      this.workspace.background !== undefined &&
      this.workspace.background.service_worker === sourcePath
    ) {
      this.workspace.background = {
        ...this.workspace.background,
        service_worker: targetPath,
      };
    }

    // popup
    if (this.workspace.action !== undefined && this.workspace.action.default_popup === sourcePath) {
      this.workspace.action = {
        ...this.workspace.action,
        default_popup: targetPath,
      };
    }

    if (this.workspace.content_scripts !== undefined) {
      // content js
      this.workspace.content_scripts.forEach((script) => {
        if (script.js !== undefined) {
          script.js = script.js.map((js) => {
            if (js === sourcePath) {
              return targetPath;
            } else {
              return js;
            }
          });
        }
        // content css
        if (script.css !== undefined) {
          script.css = script.css.map((css) => {
            if (css === sourcePath) {
              return targetPath;
            } else {
              return css;
            }
          });
        }
      });
    }

    // Icons
    const icons = structuredClone(this.workspace.icons);
    if (icons !== undefined) {
      const newIcons: Record<number, string> = {
        ...icons,
      };

      Object.keys(icons).forEach((size) => {
        const sizeN = size as unknown as number;
        const icon = icons[sizeN];

        if (icon === sourcePath) {
          newIcons[sizeN] = targetPath;
        }
      });

      this.workspace.icons = newIcons;
    }
  }

  public addContentScript(
    js: string[],
    css: string[],
    matches: string[],
    world: 'MAIN' | 'ISOLATED' = 'ISOLATED',
    run_at: 'document_start' | 'document_end' | 'document_idle' | undefined = undefined,
  ) {
    if (this.workspace.content_scripts !== undefined) {
      this.workspace.content_scripts.push({
        matches,
        js,
        css,
        world,
        run_at,
      });
    }
  }

  private absorbCustomKeys(original: CrxmManifestImportantKeys) {
    const result = structuredClone(original);

    if (original.content_scripts !== undefined && result.content_scripts !== undefined) {
      original.content_scripts.forEach((content_script, index) => {
        Object.keys(content_script).forEach((key) => {
          if (this.definedCustomKeysByCrxMonkeyInContentScrpt.includes(key)) {
            if (result.content_scripts !== undefined) {
              delete result.content_scripts[index][key];
            }
          }
        });
      });
    }

    return result;
  }
}
