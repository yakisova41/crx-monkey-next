import { parse, HTMLElement } from 'node-html-parser';
import fse from 'fs-extra';
import { basename, dirname, resolve } from 'path';
import { watch, FSWatcher } from 'fs';
import { CrxmBundlerPlugin, CrxmBundlerPluginWatch, I_CrxmBundler } from '../../typeDefs';

export class HTMLTools {
  private htmlParserRoot: HTMLElement;

  private stackInterval: NodeJS.Timeout | null = null;
  private watcher: FSWatcher | null = null;
  private parseResult: PopupBuilderParsed = {
    requestLocalScripts: {},
    requestLocalHrefFiles: {},
    requestLocalSrcFiles: {},
  };

  constructor(
    private readonly popupPath: string,
    private readonly distPath: string,
    private readonly plugins: {
      build: Record<string, CrxmBundlerPlugin>;
      watch: Record<string, CrxmBundlerPluginWatch>;
    },
    private readonly bundler: I_CrxmBundler,
  ) {
    this.htmlParserRoot = this.getParser(popupPath);
  }

  public async buildForUserjs() {
    const htmlParserRoot = this.getParser(this.popupPath);
    const parseResult = this.parse();
    const diff = this.getParseResultDiff(parseResult);
    const decorder = new TextDecoder();

    diff.localScripts.add.forEach((scriptPath) => {
      const result = this.bundler.getBuildResultFromPath(scriptPath);
      if (result !== undefined) {
        const targetElement = parseResult.requestLocalSrcFiles[scriptPath];
        const resultStr = decorder.decode(result);
        targetElement.innerHTML = resultStr;
      }
    });

    return htmlParserRoot.toString();
  }

  public async build() {
    this.htmlParserRoot = this.getParser(this.popupPath);
    const result = this.parse();
    const diff = this.getParseResultDiff(result);
    this.parseResult = result;
    const hashs = this.registerDiffToBundler(diff);
    this.syncAssets(diff);
    return hashs;
  }

  public async watchHTML() {
    const stack: (() => Promise<void>)[] = [];

    // When html updated
    const onUpdate = async () => {
      this.htmlParserRoot = this.getParser(this.popupPath);
      const result = this.parse();

      const diff = this.getParseResultDiff(result);
      this.parseResult = result;

      this.registerDiffToBundler(diff);
      this.syncAssets(diff);

      await this.bundler.stopWatch();
      await this.bundler.watch();
    };

    await onUpdate();

    this.watcher = watch(this.popupPath);

    this.watcher.addListener('change', () => {
      stack.push(onUpdate);
    });

    this.stackInterval = setInterval(async () => {
      if (stack[0] !== undefined) {
        await stack[0]();
        stack.splice(0, 1);
      }
    }, 1000);
  }

  public stopWatch() {
    if (this.stackInterval !== null) {
      clearInterval(this.stackInterval);
    }

    if (this.watcher !== null) {
      this.watcher.close();
    }
  }

  public resolveScript(entry: string, target: string) {
    const targetElement = this.parseResult.requestLocalScripts[this.resolveFilePath(entry)];
    targetElement.setAttribute('src', target);
  }

  public resolveHref(entry: string, target: string) {
    const targetElement = this.parseResult.requestLocalHrefFiles[this.resolveFilePath(entry)];
    targetElement.setAttribute('href', target);
  }

  public resolveSrc(entry: string, target: string) {
    const targetElement = this.parseResult.requestLocalSrcFiles[this.resolveFilePath(entry)];
    targetElement.setAttribute('src', target);
  }

  public outputHtmlResolved() {
    return this.htmlParserRoot.toString();
  }

  private syncAssets(
    diff: Record<
      'localScripts' | 'localHrefFiles' | 'localSrcFiles',
      {
        add: string[];
        delete: string[];
      }
    >,
  ) {
    diff.localSrcFiles.add.forEach((filePath: string) => {
      const baseFileName = basename(filePath);
      const newFilePath = '/assets/' + baseFileName;

      fse.copySync(filePath, resolve(this.distPath, 'assets', baseFileName));
      this.resolveSrc(filePath, newFilePath);
    });

    diff.localSrcFiles.delete.forEach((filePath: string) => {
      const baseFileName = basename(filePath);
      const newFilePath = '/assets/' + baseFileName;

      fse.removeSync(newFilePath);
    });
  }

  private registerDiffToBundler(
    diff: Record<
      'localScripts' | 'localHrefFiles' | 'localSrcFiles',
      {
        add: string[];
        delete: string[];
      }
    >,
  ) {
    const hashs: string[] = [];

    const targetGroups: [string, string[]][] = [
      ['html_script', diff.localScripts.add],
      ['html_href', diff.localHrefFiles.add],
    ];

    for (const [type, paths] of targetGroups) {
      for (const path of paths) {
        if (type === 'html_script' || type === 'html_href') {
          const buildPlugin = this.getAppropriateBuildPlugin(path);
          const watchPlugin = this.getAppropriateWatchPlugin(path);

          if (!buildPlugin) {
            console.error(`Could not find the appropriate plugin for building "${path}"`);
            continue;
          }

          if (!watchPlugin) {
            console.error(`Could not find the appropriate plugin for watching "${path}"`);
            continue;
          }

          const hash = this.bundler.addTarget(
            path,
            { build: buildPlugin, watch: watchPlugin },
            type,
          );
          hashs.push(hash);
        }
      }
    }

    [...diff.localScripts.delete, ...diff.localHrefFiles.delete].forEach((path) => {
      this.bundler.removeTarget(path);
    });

    return hashs;
  }

  /**
   * Get diff that loaded resources in html what with added or deleted.
   * @returns
   */
  private getParseResultDiff(newResult: PopupBuilderParsed) {
    const result: Record<
      'localScripts' | 'localHrefFiles' | 'localSrcFiles',
      { add: string[]; delete: string[] }
    > = {
      localScripts: {
        add: [],
        delete: [],
      },
      localHrefFiles: {
        add: [],
        delete: [],
      },
      localSrcFiles: {
        add: [],
        delete: [],
      },
    };

    const setDiff = (
      key: keyof typeof result,
      elements: Record<string, HTMLElement>,
      original: Record<string, HTMLElement>,
    ) => {
      Object.keys(elements).forEach((requestURL) => {
        if (original[requestURL] === undefined) {
          result[key].add.push(requestURL);
        }
      });

      Object.keys(original).forEach((requestURL) => {
        if (elements[requestURL] === undefined) {
          result[key].delete.push(requestURL);
        }
      });
    };

    setDiff('localScripts', newResult.requestLocalScripts, this.parseResult.requestLocalScripts);
    setDiff(
      'localHrefFiles',
      newResult.requestLocalHrefFiles,
      this.parseResult.requestLocalHrefFiles,
    );
    setDiff('localSrcFiles', newResult.requestLocalSrcFiles, this.parseResult.requestLocalSrcFiles);

    return result;
  }

  /**
   * Parse popup html
   * @param filePath
   * @returns
   */
  public parse(): PopupBuilderParsed {
    return {
      requestLocalScripts: this.getResourceElement(this.htmlParserRoot, 'script', 'src'),
      requestLocalHrefFiles: this.getResourceElement(this.htmlParserRoot, 'link', 'href'),
      requestLocalSrcFiles: this.getResourceElement(
        this.htmlParserRoot,
        'video, img, iframe',
        'src',
      ),
    };
  }

  /**
   * Get elements for loading any resource. for example, script or img link anymore..
   * @param root
   * @param selector
   * @param resourceURLAttr
   * @returns
   */
  private getResourceElement(root: HTMLElement, selector: string, resourceURLAttr: string) {
    const elems = root.querySelectorAll(selector);

    const ResultElems: Record<string, HTMLElement> = {};

    elems.forEach((elem) => {
      const noBundleAttr = elem.getAttribute('no-bundle');

      if (noBundleAttr !== '' && noBundleAttr !== 'true') {
        const src = elem.getAttribute(resourceURLAttr);
        if (src !== undefined && src !== null) {
          // Except the script href that start http.
          if (src.match('^http.*') === null) {
            const resolvedPath = this.resolveFilePath(src);

            ResultElems[resolvedPath] = elem;
          }
        }
      }
    });

    return ResultElems;
  }

  /**
   * Resolve path
   */
  private resolveFilePath(contentPath: string) {
    return resolve(dirname(this.popupPath), contentPath);
  }

  /**
   * Get Html parser instance.
   * @param htmlPath
   * @returns
   */
  private getParser(htmlPath: string) {
    const content = fse.readFileSync(htmlPath).toString();
    const root = parse(content);

    return root;
  }

  /**
   * Get build plugin
   * @param filePath
   * @returns
   */
  private getAppropriateBuildPlugin(filePath: string) {
    for (const [pattern, plugin] of Object.entries(this.plugins.build)) {
      const regex = new RegExp(pattern);
      if (regex.test(filePath)) {
        return plugin;
      }
    }

    return null;
  }

  /**
   * Get watch plugin
   * @param filePath
   * @returns
   */
  private getAppropriateWatchPlugin(filePath: string) {
    for (const [pattern, plugin] of Object.entries(this.plugins.watch)) {
      const regex = new RegExp(pattern);
      if (regex.test(filePath)) {
        return plugin;
      }
    }

    return null;
  }
}

export interface PopupBuilderParsed {
  requestLocalScripts: Record<string, HTMLElement>;
  requestLocalHrefFiles: Record<string, HTMLElement>;
  requestLocalSrcFiles: Record<string, HTMLElement>;
}
