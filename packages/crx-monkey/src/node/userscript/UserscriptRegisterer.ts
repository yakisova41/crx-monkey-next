import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { ManifestFactory } from '../manifest/ManifestFactory';
import { UserscriptHeaderFactory } from './UserscriptHeader';
import { ManifestParser } from '../manifest/ManifestParser';
import { ManifestLoader } from '../manifest/ManifestLoader';
import fse from 'fs-extra';
import { geti18nMessages } from '../manifest/i18n';
import { ConfigLoader } from '../ConfigLoader';

@injectable()
export class UserscriptRegisterer {
  constructor(
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.UserscriptHeaderFactory)
    private readonly headerFactory: UserscriptHeaderFactory,
    @inject(TYPES.ManifestParser) private readonly manifestParser: ManifestParser,
    @inject(TYPES.ManifestLoader) private readonly manifestLoader: ManifestLoader,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
  ) {}

  public async sync() {
    await this.setManifestToUserscript();
  }

  private async setManifestToUserscript() {
    const rawManifest = this.manifestLoader.useManifest();
    const userscriptHeaderFactory = this.headerFactory;
    const config = this.configLoader.useConfig();

    if (rawManifest.content_scripts !== undefined) {
      const { allMatches } = this.createMatchMap();

      if (allMatches.includes('<all_urls>')) {
        userscriptHeaderFactory.push('@match', 'http://*/*');
        userscriptHeaderFactory.push('@match', 'https://*/*');
      } else {
        allMatches.forEach((match) => {
          userscriptHeaderFactory.push('@match', match);
        });
      }
    }

    /**
     * Set version designation by manifest to header.
     */
    userscriptHeaderFactory.push('@version', rawManifest.version);

    /*
    if (rawManifest.run_at !== undefined) {
      userscriptHeaderFactory.push(
        '@run-at',
        this.convertChromeRunAtToUserJsRunAt(rawManifest.run_at),
      );
    } else {*/
    userscriptHeaderFactory.push('@run-at', 'document-start');
    // }

    /**
     * Set name.
     * If can not found locale message, even if language key is not en, it will be en.
     */
    const names = await geti18nMessages(rawManifest.name);
    Object.keys(names).forEach((lang) => {
      if (lang === 'en') {
        // default is en.
        userscriptHeaderFactory.push('@name', names[lang]);
      } else {
        userscriptHeaderFactory.push(`@name:${lang}`, names[lang]);
      }
    });

    /**
     * Set description.
     * If can not found locale message, even if language key is not en, it will be en.
     */
    if (rawManifest.description !== undefined) {
      const descriptions = await geti18nMessages(rawManifest.description);
      Object.keys(descriptions).forEach((lang) => {
        if (lang === 'en') {
          userscriptHeaderFactory.push('@description', descriptions[lang]);
        } else {
          userscriptHeaderFactory.push(`@description:${lang}`, descriptions[lang]);
        }
      });
    }

    if (rawManifest.content_scripts !== undefined) {
      let useDirectInject = false;

      rawManifest.content_scripts.forEach(({ userscript_direct_inject }) => {
        if (userscript_direct_inject) {
          useDirectInject = true;
        }
      });

      if (useDirectInject) {
        userscriptHeaderFactory.push('@grant', 'unsafeWindow');
      }
    }

    /**
     * Icon
     */
    const icons = this.manifestParser.parseResult.icons;
    if (icons !== null) {
      const keys = Object.keys(icons);
      if (keys.length === 0) return undefined;

      const minSize = Math.min(...keys.map(Number));

      const minIcon = icons[minSize];

      const base64 = this.convertImgToBase64(minIcon.path);

      userscriptHeaderFactory.push('@icon', base64);
    }

    /**
     * If using popup
     */
    if (
      config.popup_in_userscript &&
      this.manifestParser.parseResult.resources.htmlResources.popup.length !== 0
    ) {
      userscriptHeaderFactory.push('@grant', 'GM.registerMenuCommand');
      userscriptHeaderFactory.push('@grant', 'unsafeWindow');
    }

    /**
     * Add aditional headers
     */
    const { header } = this.configLoader.useConfig();
    if (header !== undefined) {
      header.forEach(([key, value]) => {
        userscriptHeaderFactory.push(key, value);
      });
    }
  }

  /**
   * Enumerate all js and css paths from conetnt_scripts in manifestjson
   * @param contentScripts
   * @param jsFiles
   * @param cssFiles
   * @returns
   */
  private createMatchMap() {
    const { scriptResources, cssResources } = this.manifestParser.parseResult.resources.raw;
    const { content_scripts } = this.manifestLoader.useManifest();

    const allMatches: string[] = [];
    const matchMap: Record<string, string[]> = {};

    scriptResources.content.forEach((jsPath) => {
      matchMap[jsPath] = [];
    });
    cssResources.forEach((cssPath) => {
      matchMap[cssPath] = [];
    });

    content_scripts.forEach((contentScript) => {
      const matches = contentScript.matches;

      if (matches !== undefined) {
        matches.forEach((match) => {
          if (!allMatches.includes(match)) {
            allMatches.push(match);
          }
        });

        contentScript.js?.forEach((jsPath) => {
          matchMap[jsPath].push(...matches);
        });

        contentScript.css?.forEach((cssPath) => {
          matchMap[cssPath].push(...matches);
        });
      }
    });

    return { matchMap, allMatches };
  }

  /**
   * Run_at in chrome extension manifest convert to runAt in userscript.
   * @param chromeRunAt
   * @returns
   */
  private convertChromeRunAtToUserJsRunAt(
    chromeRunAt: 'document_start' | 'document_end' | 'document_idle',
  ): 'document-start' | 'document-end' | 'document-idle' {
    if (chromeRunAt === 'document_start') {
      return 'document-start';
    } else if (chromeRunAt === 'document_end') {
      return 'document-end';
    } else if (chromeRunAt === 'document_idle') {
      return 'document-idle';
    } else {
      throw new Error(
        [
          'Unknown run_at type.',
          'Please specify a valid run_at',
          'Chrome Reference: https://developer.chrome.com/docs/extensions/reference/api/extensionTypes?hl=ja#type-RunAt',
        ].join('\n'),
      );
    }
  }

  /**
   * Convert image to base64 string.
   * @param imgPath Local image file path.
   * @returns
   */
  private convertImgToBase64(imgPath: string) {
    const icon = fse.readFileSync(imgPath);
    const buf = Buffer.from(icon).toString('base64');
    return `data:image/png;base64,${buf}`;
  }
}
