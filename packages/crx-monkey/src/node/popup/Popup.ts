import { inject, injectable } from 'inversify';
import type { CrxmBundlerPlugin, CrxmBundlerPluginWatch } from '../typeDefs';
import { TYPES } from '../types';
import { parse, HTMLElement, Node, NodeType } from 'node-html-parser';
import fse from 'fs-extra';
import { ConfigLoader } from '../ConfigLoader';
import { basename, dirname, resolve } from 'path';
import { CrxmBundler } from '../CrxmBundler';
import MurmurHash3 from 'murmurhash3js';
import { ManifestFactory } from '../manifest/ManifestFactory';
import { fileToDataUri } from '../file';
import { htmlBundler, htmlBundlerWatch } from '../plugins/htmlBundler';
import { Logger } from '../Logger';
import chalk from 'chalk';

@injectable()
export class Popup {
  private assets: PopupBuilderAssets | undefined;
  private plugins: {
    build: Record<string, CrxmBundlerPlugin>;
    watch: Record<string, CrxmBundlerPluginWatch>;
  };
  private outputDir: string;
  private syncResults: SyncResult[] = [];
  private parser: {
    extension: undefined | HTMLElement;
    userjs: undefined | HTMLElement;
  } = {
    extension: undefined,
    userjs: undefined,
  };
  private entry: null | string = null;
  private diff: null | Diff = null;

  constructor(
    @inject(TYPES.CrxmBundler) private readonly bundler: CrxmBundler,
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {
    const {
      build,
      watch,
      output: { chrome },
    } = this.configLoader.useConfig();

    if (chrome === undefined) {
      throw new Error('The Chrome dist is undefined.');
    }

    this.plugins = { build, watch };
    this.outputDir = chrome;
  }

  /**
   * Parse HTML, register all loaded resources with the bundler, and create a diff.
   */
  public async register(htmlEntry: string) {
    this.entry = htmlEntry;

    const assets = await this.getAllAssets(htmlEntry);
    const diff = this.getDiffFromAssets(assets, this.assets);
    this.diff = diff;
    this.assets = assets;
    this.syncResults = await this.syncBundler(htmlEntry, diff);

    this.parser.extension = await this.getParser(htmlEntry);
    this.parser.userjs = await this.getParser(htmlEntry);

    this.logger.dispatchDebug(`🧇 Popup registered ${chalk.gray(`"${htmlEntry}"`)}`);
  }

  public async remove(htmlEntry: string) {
    if (this.entry !== null && (await fse.exists(this.entry))) {
      const assets: PopupBuilderAssets = {
        scripts: [],
        hrefFiles: [],
        srcFiles: [],
      };
      const diff = this.getDiffFromAssets(assets, this.assets);

      await fse.remove(this.entry);
      await this.syncBundler(htmlEntry, diff);
    }
  }

  public async refreshParser() {
    if (this.entry === null) {
      throw new Error('The HTML entry is null. Is it registered?');
    }
    // Refresh parser
    this.parser.extension = await this.getParser(this.entry);
  }

  /**
   * Get HTML files content and resources for the extension
   */
  public async getHTML() {
    if (this.parser.extension === undefined) {
      throw new Error('No parser available, please register.');
    }

    if (this.entry === null) {
      throw new Error('The HTML entry is null. Is it registered?');
    }

    await this.outputAssetsToDist();

    const data = this.parser.extension.toString();

    const endemicHash = MurmurHash3.x86.hash32(this.entry).toString();
    const fileName = endemicHash + '_' + this.changeExt(this.entry, 'html');

    const outputPath = resolve(this.outputDir, fileName);

    return {
      contents: data,
      outputPath,
      resolveManifest: () => {
        if (this.manifestFactory.rawManifest.action?.default_popup !== undefined) {
          this.manifestFactory.resolve(
            this.manifestFactory.rawManifest.action?.default_popup,
            fileName,
          );
        }
      },
    };
  }

  /**
   * Obtain HTML string with userjs resources inlined
   * @returns
   */
  public async getHtmlInlined() {
    if (this.parser.userjs === undefined) {
      throw new Error('No parser available, please register.');
    }

    if (this.entry === null) {
      throw new Error('The HTML entry is null. Is it registered?');
    }

    // Refresh Parser
    this.parser.userjs = await this.getParser(this.entry);

    this.resolveInline();
    this.applyCssForUserjsPopup();
    await this.injectEncodedAssetesToInline();

    const data = this.parser.userjs.toString();

    return data;
  }

  /**
   * Register the style to be specified for the userjs popup
   */
  private applyCssForUserjsPopup() {
    if (this.parser.userjs === undefined) {
      throw new Error('No parser available, please register.');
    }

    class Style extends Node {
      text: string = '';
      rawText: string = '';

      toString(): string {
        return String(`<style>\n\t${this.rawText}\n</style>`);
      }
      clone(): Node {
        return structuredClone(this);
      }
      nodeType: NodeType = 3;
      rawTagName: string = 'style';
    }

    const style = new Style();
    style.textContent = `body {
    overflow: auto;         
    scrollbar-width: none;   
    -ms-overflow-style: none;
  }
  
  ::-webkit-scrollbar {
    width: 0;
    height: 0;
  }`;
    this.parser.userjs.appendChild(style);

    this.logger.dispatchDebug(`🧇 Default css has appended to popup.`);
  }

  public async getExtensionResources() {
    return this.syncResults.map(({ hash, entry }) => {
      const target = this.bundler.targets[hash];
      return {
        target,
        resolveTarget: (newfileName: string) => {
          if (target.flag === 'html_script') {
            this.resolveAttr(entry, newfileName, 'script', 'src', this.parser.extension);
          } else {
            this.resolveAttr(entry, newfileName, 'link', 'href', this.parser.extension);
            this.resolveAttr(entry, newfileName, 'a', 'href', this.parser.extension);
          }
        },
      };
    });
  }

  /**
   * Output resources used in the extension popup
   */
  private async outputExtensionResources() {
    await Promise.all(
      this.syncResults.map(async ({ hash, entry }) => {
        const target = this.bundler.targets[hash];
        let result = this.bundler.compileResults[hash];

        if (result === undefined) {
          await this.bundler.compileForce(hash);
          result = this.bundler.compileResults[hash];

          if (result === undefined) {
            throw new Error(
              `The result of "${hash}" is undefined.\nEntryPoint: "${target.entryPoint}"`,
            );
          }
        }

        if (target.flag === 'html_script' || target.flag === 'html_href') {
          const extChanged =
            target.flag === 'html_script'
              ? this.changeExt(target.entryPoint, 'js')
              : this.changeExt(target.entryPoint, 'css');

          const endemicHash = MurmurHash3.x86.hash32(target.entryPoint).toString();

          const fileName = endemicHash + '_' + extChanged;

          const outputPath = resolve(this.outputDir, fileName);

          await fse.outputFile(outputPath, result);

          this.logger.dispatchDebug(
            `👋 An asset loaded by popup has been outputed. ${chalk.gray(`"${target.entryPoint}" -> "${outputPath}"`)}`,
          );

          if (target.flag === 'html_script') {
            this.resolveAttr(entry, fileName, 'script', 'src', this.parser.extension);
          } else {
            this.resolveAttr(entry, fileName, 'link', 'href', this.parser.extension);
            this.resolveAttr(entry, fileName, 'a', 'href', this.parser.extension);
          }
        }
      }),
    );
  }

  /**
   * Copy media resources used in extension pop-ups
   */
  private async outputAssetsToDist() {
    if (this.entry === null) {
      throw new Error('The HTML entry is null. Is it registered?');
    }

    if (this.diff === null) {
      throw new Error('The diff is null. Is it registered?');
    }

    const htmlDir = dirname(this.entry);

    await Promise.all([
      ...this.diff.srcFiles.add.map(async (filePath: string) => {
        const baseFileName = basename(filePath);
        const newFilePath = '/public/' + baseFileName;
        const absolutedNewFilePath = resolve(this.outputDir, 'public', baseFileName);

        // unlink
        if (await fse.exists(absolutedNewFilePath)) {
          await fse.remove(absolutedNewFilePath);
        }

        await fse.copy(resolve(htmlDir, filePath), absolutedNewFilePath, { overwrite: true });

        this.resolveAttr(filePath, newFilePath, 'img', 'src', this.parser.extension);
        this.resolveAttr(filePath, newFilePath, 'video', 'src', this.parser.extension);
        this.resolveAttr(filePath, newFilePath, 'iframe', 'src', this.parser.extension);

        this.logger.dispatchDebug(
          `👋 A media loaded by popup has been outputed. ${chalk.gray(`"${filePath}" -> "${newFilePath}"`)}`,
        );
      }),

      ...this.diff.srcFiles.delete.map(async (filePath: string) => {
        const baseFileName = basename(filePath);
        const absolutedNewFilePath = resolve(this.outputDir, 'public', baseFileName);

        await fse.remove(absolutedNewFilePath);
      }),
    ]);
  }

  /**
   * Encode and inject media resources used in userjs popup
   */
  private async injectEncodedAssetesToInline() {
    if (this.entry === null) {
      throw new Error('The HTML entry is null. Is it registered?');
    }

    if (this.diff === null) {
      throw new Error('The diff is null. Is it registered?');
    }

    const htmlDir = dirname(this.entry);

    await Promise.all(
      this.diff.srcFiles.add.map(async (filePath: string) => {
        const content = await fileToDataUri(resolve(htmlDir, filePath));

        if (content === undefined) {
          throw new Error(
            `The content of resource "${filePath}" loaded within the HTML file "${htmlDir}" was undefined.`,
          );
        }

        this.resolveAttr(filePath, content, 'img', 'src', this.parser.userjs);
        this.resolveAttr(filePath, content, 'video', 'src', this.parser.userjs);
        this.resolveAttr(filePath, content, 'iframe', 'src', this.parser.userjs);
      }),
    );
  }

  private resolveInline() {
    const parser = this.parser?.userjs;
    if (parser === undefined) {
      throw new Error('No parser available, please register.');
    }

    this.syncResults.forEach(({ hash, entry }) => {
      const target = this.bundler.targets[hash];
      const result = this.bundler.compileResults[hash];

      const decoder = new TextDecoder();
      const resultStr = decoder.decode(result);
      const escaped = resultStr.replaceAll('`', '\\`');

      if (target.flag === 'html_script') {
        const nodes = parser.querySelectorAll(`script[src="${entry}"]`);
        nodes.forEach((node) => {
          node.removeAttribute('src');
          node.innerHTML = escaped;
        });
      }

      if (target.flag === 'html_href') {
        const nodes = parser.querySelectorAll(`link[rel="stylesheet"][href="${entry}"]`);
        nodes.forEach((node) => {
          node.removeAttribute('href');
          node.tagName = 'style';
          node.innerHTML = resultStr;
        });
      }
    });
  }

  private resolveAttr(
    entry: string,
    target: string,
    selector: string,
    attr: string,
    parserRoot?: HTMLElement,
  ) {
    if (parserRoot === undefined) {
      throw new Error('No parser available, please register.');
    }

    const nodes = parserRoot.querySelectorAll(`${selector}[${attr}="${entry}"]`);
    nodes.forEach((node) => {
      node.setAttribute(attr, target);
    });
  }

  private async getAllAssets(htmlEntry: string): Promise<PopupBuilderAssets> {
    function getAllResourceByElement(root: HTMLElement, selector: string, resourceURLAttr: string) {
      const elems = root.querySelectorAll(selector);

      const result: string[] = [];

      elems.forEach((elem) => {
        // ignore if attributed.
        const noBundleAttr = elem.getAttribute('no-bundle');

        if (noBundleAttr !== '' && noBundleAttr !== 'true') {
          const src = elem.getAttribute(resourceURLAttr);
          if (src !== undefined && src !== null) {
            // Except the script href that start http.
            if (src.match('^http:|https:|file:|data:.*') === null && !result.includes(src)) {
              result.push(src);
            }
          }
        }
      });

      return result;
    }

    const parser = await this.getParser(htmlEntry);

    return {
      scripts: getAllResourceByElement(parser, 'script', 'src'),
      hrefFiles: getAllResourceByElement(parser, 'link, a', 'href'),
      srcFiles: getAllResourceByElement(parser, 'video, img, iframe', 'src'),
    };
  }

  /**
   * Get diff that loaded resources in html what with added or deleted.
   * @returns
   */
  private getDiffFromAssets(newAssets: PopupBuilderAssets, oldAssets?: PopupBuilderAssets): Diff {
    const diffArray = (
      beforeArr: string[] | undefined,
      afterArr: string[],
    ): { add: string[]; delete: string[] } => {
      if (!beforeArr) {
        return {
          add: [...afterArr],
          delete: [],
        };
      }

      return {
        add: afterArr.filter((v) => !beforeArr.includes(v)),
        delete: beforeArr.filter((v) => !afterArr.includes(v)),
      };
    };

    return {
      scripts: diffArray(oldAssets?.scripts, newAssets.scripts),
      hrefFiles: diffArray(oldAssets?.hrefFiles, newAssets.hrefFiles),
      srcFiles: diffArray(oldAssets?.srcFiles, newAssets.srcFiles),
    };
  }

  /**
   * Get Html parser instance.
   * @param htmlPath
   * @returns
   */
  private async getParser(htmlPath: string) {
    const content = await fse.readFile(htmlPath);
    const data = content.toString();
    const root = parse(data);

    return root;
  }

  /**
   * Register all assets to crxm bundler.
   * @param diff
   * @returns
   */
  private async syncBundler(htmlEntry: string, diff: Diff): Promise<SyncResult[]> {
    // register html
    this.bundler.addTarget(
      htmlEntry,
      {
        build: htmlBundler,
        watch: htmlBundlerWatch,
      },
      'html',
    );

    // register script or css
    const result: SyncResult[] = [];

    const targetGroups: [string, string[]][] = [
      ['html_script', diff.scripts.add],
      ['html_href', diff.hrefFiles.add],
    ];

    for (const [type, paths] of targetGroups) {
      for (const path of paths) {
        const absoluted = await this.getTargetAbsolutePath(htmlEntry, path);

        if (type === 'html_script' || type === 'html_href') {
          const buildPlugin = this.getAppropriatePlugin(absoluted, 'build');
          const watchPlugin = this.getAppropriatePlugin(absoluted, 'watch');

          if (!buildPlugin) {
            console.error(`Could not find the appropriate plugin for building "${absoluted}"`);
            continue;
          }

          if (!watchPlugin) {
            console.error(`Could not find the appropriate plugin for watching "${absoluted}"`);
            continue;
          }

          const hash = this.bundler.addTarget(
            absoluted,
            { build: buildPlugin, watch: watchPlugin },
            type,
          );

          result.push({ hash, entry: path, absolutedEntry: absoluted });
        }
      }
    }

    [...diff.scripts.delete, ...diff.hrefFiles.delete].forEach((path) => {
      this.bundler.removeTarget(path);
    });

    return result;
  }

  private async getTargetAbsolutePath(htmlEntry: string, entry: string) {
    const dir = dirname(htmlEntry);
    return resolve(dir, entry);
  }

  /**
   * Get watch plugin
   * @param filePath
   * @returns
   */
  private getAppropriatePlugin<T extends 'watch' | 'build'>(
    filePath: string,
    type: T,
  ): { build: CrxmBundlerPlugin; watch: CrxmBundlerPluginWatch }[T] | null {
    let _plugin = null;
    for (const [pattern, plugin] of Object.entries(this.plugins[type])) {
      const regex = new RegExp(pattern);
      if (regex.test(filePath)) {
        _plugin = plugin;
      }
    }

    return _plugin;
  }

  private changeExt(filePath: string, newExt: string) {
    const rawFileNameSplited = basename(filePath).split('.');
    rawFileNameSplited[rawFileNameSplited.length - 1] = newExt;
    const newFilename = rawFileNameSplited.join('.');
    return newFilename;
  }
}

/**
 * All scripts and css or img etc.. source filePaths declared in html
 */
interface PopupBuilderAssets {
  scripts: string[];
  hrefFiles: string[];
  srcFiles: string[];
}

interface SyncResult {
  absolutedEntry: string;
  entry: string;
  hash: string;
}

type Diff = Record<'scripts' | 'hrefFiles' | 'srcFiles', { add: string[]; delete: string[] }>;
