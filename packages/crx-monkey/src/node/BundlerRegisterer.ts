import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import { ManifestLoader } from './manifest/ManifestLoader';
import { ManifestParser } from './manifest/ManifestParser';
import { ConfigLoader } from './ConfigLoader';
import { CrxmBundler } from './CrxmBundler';
import chalk from 'chalk';
import { Logger } from './Logger';
import { Distributior } from './Distributior';
import { Popup } from './popup/Popup';
import { CrxmBundlerPlugin, CrxmBundlerPluginWatch, FilePath } from './typeDefs';

export interface I_BundlerRegisterer {}

@injectable()
export class BundlerRegisterer implements I_BundlerRegisterer {
  private contentScripts: FilePath<'absolute'>[] = [];
  private sw: FilePath<'absolute'>[] = [];
  private cssResources: FilePath<'absolute'>[] = [];
  private htmlResources: FilePath<'absolute'>[] = [];

  constructor(
    @inject(TYPES.ManifestLoader) private readonly manifestLoader: ManifestLoader,
    @inject(TYPES.ManifestParser) private readonly manifestParser: ManifestParser,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.CrxmBundler) private readonly bundler: CrxmBundler,
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.Popup) private readonly popup: Popup,
    @inject(TYPES.Distributior) private readonly distributior: Distributior,
  ) {}

  /**
   * Register all build targets for bundler from manifest.
   */
  public async registerAll() {
    const fileChangeResult = this.fileChangeCheck();

    /**
     * Add added targets to bundle targets.
     */
    const addTargetGroups: [string, FilePath<'absolute'>[]][] = [
      ['content', fileChangeResult.script.content.added],
      ['sw', fileChangeResult.script.sw.added],
      ['css', fileChangeResult.css.added],
      // ['html', fileChangeResult.html.added],
    ];

    // Register sources to bundler without html.
    for (const [flag, paths] of addTargetGroups) {
      for (const path of paths) {
        const buildPlugin = this.getAppropriatePlugin(path, 'build');
        const watchPlugin = this.getAppropriatePlugin(path, 'watch');

        if (!buildPlugin) {
          console.error(`Could not find the appropriate plugin for building "${path}"`);
          continue;
        }

        if (!watchPlugin) {
          console.error(`Could not find the appropriate plugin for watching "${path}"`);
          continue;
        }

        this.bundler.addTarget(path, { build: buildPlugin, watch: watchPlugin }, flag);
      }
    }

    /**
     * Remove removed targets from bundle targets.
     */
    const rmTargetGroups: [string, FilePath<'absolute'>[]][] = [
      ['content', fileChangeResult.script.content.removed],
      ['sw', fileChangeResult.script.sw.removed],
      ['css', fileChangeResult.css.removed],
      // ['html', fileChangeResult.html.removed],
    ];

    for (const [flag, paths] of rmTargetGroups) {
      for (const path of paths) {
        this.bundler.removeTarget(path, flag);
      }
    }

    this.defineAllVars();

    /**
     * popup
     */
    await Promise.all(
      fileChangeResult.html.added.map(async (htmlEntry) => {
        await this.popup.register(htmlEntry);
      }),
    );

    fileChangeResult.html.removed.forEach(async (htmlEntry) => {
      this.popup.remove(htmlEntry);
    });
  }

  /**
   * Load and register variables written in a conifg add to the bundled code
   */
  private defineAllVars() {
    const { define } = this.configLoader.useConfig();

    if (define.contentscripts !== undefined) {
      Object.entries(define.contentscripts).forEach(([name, value]) => {
        this.distributior.addDefine(name, value, 'content');
      });
    }

    if (define.sw !== undefined) {
      Object.entries(define.sw).forEach(([name, value]) => {
        this.distributior.addDefine(name, value, 'sw');
      });
    }

    if (define.popup !== undefined) {
      Object.entries(define.popup).forEach(([name, value]) => {
        this.distributior.addDefine(name, value, 'popup');
      });
    }
  }

  private getAppropriatePlugin<T extends 'watch' | 'build'>(
    filePath: string,
    type: T,
  ): { build: CrxmBundlerPlugin; watch: CrxmBundlerPluginWatch }[T] | null {
    const { build, watch } = this.configLoader.useConfig();

    let _plugin = null;
    for (const [pattern, plugin] of Object.entries({ build, watch }[type])) {
      const regex = new RegExp(pattern);
      if (regex.test(filePath)) {
        _plugin = plugin;
      }
    }

    return _plugin;
  }

  /**
   * Compare file change.
   * @returns
   */
  private fileChangeCheck() {
    const manifest = this.manifestLoader.useManifest();

    const parsed = this.manifestParser.parse(manifest);

    const {
      resources: {
        scriptResources: { sw, content },
        cssResources,
        htmlResources,
      },
    } = parsed;

    /**
     * content Script
     */
    const contentScriptAdded: FilePath<'absolute'>[] = [];
    const contentScriptRemoved: FilePath<'absolute'>[] = [];

    content.forEach((absolutePath) => {
      if (!this.contentScripts.includes(absolutePath)) {
        // It's new file
        this.contentScripts.push(absolutePath);
        contentScriptAdded.push(absolutePath);
        this.logger.dispatchDebug(
          `👀 New content script detected ${chalk.gray('"' + absolutePath + '"')}`,
        );
      }
    });

    this.contentScripts.forEach((absolutePath) => {
      if (!content.includes(absolutePath)) {
        // It's removed file
        this.contentScripts = this.contentScripts.filter((x) => x !== absolutePath);
        contentScriptRemoved.push(absolutePath);
        this.logger.dispatchDebug(
          `👓 Removed content script detected ${chalk.gray('"' + absolutePath + '"')}`,
        );
      }
    });

    /**
     * sw
     */
    const swAdded: FilePath<'absolute'>[] = [];
    const swRemoved: FilePath<'absolute'>[] = [];

    sw.forEach((absolutePath) => {
      if (!this.sw.includes(absolutePath)) {
        // It's new file
        this.sw.push(absolutePath);
        swAdded.push(absolutePath);
        this.logger.dispatchDebug(
          `👀 New service worker detected ${chalk.gray('"' + absolutePath + '"')}`,
        );
      }
    });

    this.sw.forEach((absolutePath) => {
      if (!sw.includes(absolutePath)) {
        // It's removed file
        this.sw = this.sw.filter((x) => x !== absolutePath);
        swRemoved.push(absolutePath);
        this.logger.dispatchDebug(
          `👓 Removed service worker detected ${chalk.gray('"' + absolutePath + '"')}`,
        );
      }
    });

    /**
     * CSS
     */
    const cssAdded: FilePath<'absolute'>[] = [];
    const cssRemoved: FilePath<'absolute'>[] = [];

    cssResources.forEach((absolutePath) => {
      if (!this.cssResources.includes(absolutePath)) {
        // It's new file
        this.cssResources.push(absolutePath);
        cssAdded.push(absolutePath);
        this.logger.dispatchDebug(`👀 New css detected ${chalk.gray('"' + absolutePath + '"')}`);
      }
    });

    this.cssResources.forEach((absolutePath) => {
      if (!cssResources.includes(absolutePath)) {
        // It's removed file
        this.cssResources = this.cssResources.filter((x) => x !== absolutePath);
        cssRemoved.push(absolutePath);
        this.logger.dispatchDebug(
          `👓 Removed css detected ${chalk.gray('"' + absolutePath + '"')}`,
        );
      }
    });

    /**
     * html
     */
    const htmlAdded: FilePath<'absolute'>[] = [];
    const htmlRemoved: FilePath<'absolute'>[] = [];

    htmlResources.popup.forEach((absolutePath) => {
      if (!this.htmlResources.includes(absolutePath)) {
        // It's new file
        this.htmlResources.push(absolutePath);
        htmlAdded.push(absolutePath);
        this.logger.dispatchDebug(`👀 New html detected ${chalk.gray('"' + absolutePath + '"')}`);
      }
    });

    this.htmlResources.forEach((absolutePath) => {
      if (!htmlResources.popup.includes(absolutePath)) {
        // It's removed file
        this.htmlResources = this.htmlResources.filter((x) => x !== absolutePath);
        htmlRemoved.push(absolutePath);
        this.logger.dispatchDebug(
          `👓 Removed html detected ${chalk.gray('"' + absolutePath + '"')}`,
        );
      }
    });

    return {
      script: {
        sw: {
          added: swAdded,
          removed: swRemoved,
        },
        content: {
          added: contentScriptAdded,
          removed: contentScriptRemoved,
        },
      },
      css: {
        added: cssAdded,
        removed: cssRemoved,
      },
      html: {
        added: htmlAdded,
        removed: htmlRemoved,
      },
    };
  }
}
