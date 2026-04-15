import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import { CrxmBundler } from './CrxmBundler';
import { ManifestParser } from './manifest/ManifestParser';
import { ManifestLoader } from './manifest/ManifestLoader';
import { ManifestFactory } from './manifest/ManifestFactory';
import { ConfigLoader } from './ConfigLoader';
import { basename, dirname, resolve } from 'path';
import MurmurHash3 from 'murmurhash3js';
import fsExtra from 'fs-extra';
import { UserscriptBundler } from './userscript/UserscriptBundler';
import prettier from 'prettier';
import { CreateDevClient } from './development/CreateDevClient';
import { isolatedConnector } from './isolatedConnector';
import { Logger } from './Logger';
import chalk from 'chalk';
import { Popup } from './popup/Popup';
import { stringifyFunction } from './utils';
import { FilePath } from './typeDefs';
import { absoluteGuard } from './file';

@injectable()
export class Distributior {
  private _defines: Defines = {
    content: [],
    sw: [],
    popup: [],
  };

  public publicDirInDist = 'public';

  constructor(
    @inject(TYPES.CrxmBundler) private readonly bundler: CrxmBundler,
    @inject(TYPES.ManifestLoader) private readonly manifestLoader: ManifestLoader,
    @inject(TYPES.ManifestParser) private readonly manifestParser: ManifestParser,
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.UserscriptBundler) private readonly userscriptBundler: UserscriptBundler,
    @inject(TYPES.CreateDevClient) private readonly createDev: CreateDevClient,
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.IsWatch) private readonly isWatch: boolean,
    @inject(TYPES.BuildID) private readonly buildId: string,
    @inject(TYPES.Popup) private readonly popup: Popup,
  ) {}

  public get defines() {
    return this._defines;
  }

  /**
   * Output bundled file
   * This must be used after bundled.
   */
  public async distAll() {
    const { output } = this.configLoader.useConfig();
    const configPath = this.configLoader.useConfigPath();

    const {
      resources: { scriptResources, raw, htmlResources },
    } = this.manifestParser.parseResult;

    if (output.chrome !== undefined) {
      const outputPath = absoluteGuard(resolve(dirname(configPath), output.chrome));

      await this.outputAllChromeContentscripts(outputPath);
      await this.outputAllChromeCss(outputPath);
      if (scriptResources.sw.length !== 0) {
        await this.outputChromeSw(scriptResources.sw[0], raw.scriptResources.sw[0], outputPath);
      }

      if (htmlResources.popup.length !== 0) {
        await this.outputChromePopup(outputPath);
      }

      await this.copyPublicDir(outputPath);
      await this.copyIcons(outputPath);
      await this.outputIsolatedConnector();
      await this.outputManifest(outputPath);
    }

    if (output.userjs !== undefined) {
      const outputPath = absoluteGuard(resolve(dirname(configPath), output.userjs));

      await this.userjsBundle(outputPath);
    }
  }

  public async dist(
    targetSourceAbsolutePath: FilePath<'absolute'>,
    type: 'content' | 'sw' | 'popup' | 'css' | 'userjs',
  ) {
    const { output } = this.configLoader.useConfig();
    const configPath = this.configLoader.useConfigPath();

    if (output.chrome === undefined) {
      throw new Error('output.chrome is undefined.');
    }

    if (output.userjs === undefined) {
      throw new Error('output.userjs is undefined.');
    }

    const chromeOutputPath = absoluteGuard(resolve(dirname(configPath), output.chrome));
    const userjsOutputPath = absoluteGuard(resolve(dirname(configPath), output.userjs));

    const {
      resources: { scriptResources, raw, cssResources },
    } = this.manifestParser.parseResult;

    if (type === 'content') {
      await Promise.all(
        scriptResources.content.map(async (absolutePath, i) => {
          const pathInManifest = raw.scriptResources.content[i];

          await this.outputChromeContentScript(absolutePath, pathInManifest, chromeOutputPath);
        }),
      );
    }

    if (type === 'sw') {
      await this.outputChromeSw(
        targetSourceAbsolutePath,
        raw.scriptResources.sw[0],
        chromeOutputPath,
      );
    }

    if (type === 'popup') {
      await this.outputChromePopup(chromeOutputPath);
    }

    if (type === 'css') {
      await Promise.all(
        cssResources.map(async (absolutePath, i) => {
          const pathInManifest = raw.cssResources[i];

          await this.outputChromeCss(absolutePath, pathInManifest, chromeOutputPath);
        }),
      );
    }

    await this.outputManifest(chromeOutputPath);

    if (type === 'userjs') {
      await this.userjsBundle(userjsOutputPath);
    }
  }

  /**
   * Remove dist
   */
  public async cleanupDist() {
    const { output } = this.configLoader.useConfig();

    if (output.chrome !== undefined) {
      const dist = dirname(output.chrome);

      await fsExtra.remove(dist);
    }
  }

  public initializeDefine() {
    this._defines = {
      content: [],
      sw: [],
      popup: [],
    };
  }

  /**
   * Variables to add to your code
   * @param name
   * @param value
   * @param to
   */
  public addDefine(name: string, value: string, to: 'sw' | 'content' | 'popup') {
    this._defines[to].push({ name, value });
  }

  private createDefineCode(defines: Define[]) {
    return (
      defines
        .map(({ name, value }) => {
          return `var ${name} = ${value};`;
        })
        .join('\n') + '\n'
    );
  }

  /**
   * Convert a file extension that is .ts to .js.
   * @param filePath
   * @returns A filePath that extension converted to .js.
   */
  private changeExt<T extends FilePath<'absolute' | 'relative'>>(filePath: T, newExt: string) {
    const rawFileNameSplited = basename(filePath).split('.');
    rawFileNameSplited[rawFileNameSplited.length - 1] = newExt;
    const newFilename = rawFileNameSplited.join('.');
    return newFilename as T;
  }

  /**
   * Output manifest file.
   * This operation must be used after all transpiling.
   * @param outputPath
   */
  private async outputManifest(outputPath: FilePath<'absolute'>) {
    const manifest = this.manifestFactory.getWorkspace();
    await fsExtra.outputFile(
      resolve(outputPath, 'manifest.json'),
      JSON.stringify(manifest, undefined, 2),
    );
  }

  private async outputAllChromeContentscripts(distPath: FilePath<'absolute'>) {
    const {
      resources: { scriptResources, raw },
    } = this.manifestParser.parseResult;
    await Promise.all(
      scriptResources.content.map(async (path, i) => {
        await this.outputChromeContentScript(path, raw.scriptResources.content[i], distPath);
      }),
    );
  }

  private async outputChromePopup(distFilepath: FilePath<'absolute'>) {
    await this.popup.refreshExtensionParser();

    // Output Resources
    const resources = await this.popup.getExtensionResources();

    await Promise.all(
      resources.map(async ({ target: { entryPoint, hash, flag }, resolveTarget }) => {
        let result = this.bundler.compileResults[hash];
        if (result === undefined) {
          // Rebuild
          await this.bundler.compileForce(hash);
          result = this.bundler.compileResults[hash];

          if (result === undefined) {
            throw new Error(`The result of "${hash}" is undefined.\nEntryPoint: "${entryPoint}"`);
          }
        }

        const extConverted =
          flag === 'html_script'
            ? this.changeExt(entryPoint, 'js')
            : this.changeExt(entryPoint, 'css');

        const endemicHash = MurmurHash3.x86.hash32(entryPoint).toString();
        const fileName = endemicHash + '_' + extConverted;

        const outputPath = absoluteGuard(resolve(distFilepath, fileName));

        const d = new TextDecoder();
        const decorded = d.decode(result);

        let code: string = decorded;

        if (flag === 'html_script') {
          // Inject crxm vars
          const varinjection = [
            `var __crxm_build_id = "${this.buildId}"`,
            `var __crxm_running_env = 'chrome-html_script'`,
          ].join('\n');
          const iifeRegex = /(\((?:async\s+)?(?:function.*?|.*?=>)\s*\{)/;
          code = code.replace(iifeRegex, `$1\n${varinjection}`);
        }

        await fsExtra.outputFile(outputPath, code);

        resolveTarget(fileName);
      }),
    );

    const { contents, outputPath, resolveManifest } = await this.popup.getHTML();

    // Output html
    await fsExtra.outputFile(outputPath, contents);
    resolveManifest();

    this.logger.dispatchDebug(`👋 Output a popup html to dist. ${chalk.gray(`"${outputPath}"`)}`);
  }

  private async outputChromeContentScript(
    sourceFilePath: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'relative' | 'absolute'>,
    distFilepath: FilePath<'absolute'>,
  ) {
    let result = this.bundler.getBuildResultFromPath(sourceFilePath);

    if (result === undefined) {
      await this.bundler.compileForce(this.bundler.getInternalHashFromPath(sourceFilePath));
      result = this.bundler.getBuildResultFromPath(sourceFilePath);
    }

    if (result !== undefined) {
      const extChanged = this.changeExt(sourceFilePath, 'js');
      const endemicHash = MurmurHash3.x86.hash32(sourceFilePath).toString();

      const fileName = (endemicHash + '_' + extChanged) as FilePath<'relative'>;

      const outputPath = absoluteGuard(resolve(distFilepath, fileName));

      const decoder = new TextDecoder();

      let decorded = decoder.decode(result);

      // Inject crxm vars
      const varinjection = [
        `var __crxm_build_id = "${this.buildId}"`,
        `var __crxm_running_env = 'chrome-content'`,
      ].join('\n');
      const iifeRegex = /(\((?:async\s+)?(?:function.*?|.*?=>)\s*\{)/;
      decorded = decorded.replace(iifeRegex, `$1\n${varinjection}`);

      const code: string | Uint8Array = this.createDefineCode(this._defines.content) + decorded;

      this.logger.dispatchDebug(
        `👋 Output a contentscript to dist. ${chalk.gray(`${sourceFilePath}" -> "${outputPath}`)}`,
      );
      await fsExtra.outputFile(outputPath, code);

      this.manifestFactory.resolve(sourceFilePathInManifest, fileName);
    }
  }

  private async outputChromeSw(
    sourcePath: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'absolute' | 'relative'>,
    distFilepath: FilePath<'absolute'>,
  ) {
    let buildResult = this.bundler.getBuildResultFromPath(sourcePath);

    if (buildResult === undefined) {
      await this.bundler.compileForce(this.bundler.getInternalHashFromPath(sourcePath));
      buildResult = this.bundler.getBuildResultFromPath(sourcePath);
    }

    const extChanged = this.changeExt(sourcePath, 'js');
    const endemicHash = MurmurHash3.x86.hash32(sourcePath).toString();

    const fileName = (endemicHash + '_' + extChanged) as FilePath<'relative'>;

    const outputPath = absoluteGuard(resolve(distFilepath, fileName));

    if (buildResult !== undefined) {
      const decoder = new TextDecoder();
      let resultDecoded = decoder.decode(buildResult);

      // Inject crxm vars
      const varinjection = [
        `var __crxm_build_id = "${this.buildId}"`,
        `var __crxm_running_env = 'chrome-sw'`,
      ].join('\n');
      const iifeRegex = /(\((?:async\s+)?(?:function.*?|.*?=>)\s*\{)/;
      resultDecoded = resultDecoded.replace(iifeRegex, `$1\n${varinjection}`);

      let code: string;

      if (this.isWatch) {
        code =
          this.createDefineCode(this._defines.sw) +
          this.createDev.outputDevelomentSw(resultDecoded);
      } else {
        code = this.createDefineCode(this._defines.sw) + resultDecoded;
      }

      this.logger.dispatchDebug(
        `👋 Output a service worker to dist. ${chalk.gray(`${sourcePath}" -> "${outputPath}`)}`,
      );
      await fsExtra.outputFile(outputPath, code);

      this.manifestFactory.resolve(sourceFilePathInManifest, fileName);
    }
  }

  private async outputAllChromeCss(distPath: FilePath<'absolute'>) {
    const {
      resources: { cssResources, raw },
    } = this.manifestParser.parseResult;

    await Promise.all(
      cssResources.map(async (path, i) => {
        await this.outputChromeCss(path, raw.cssResources[i], distPath);
      }),
    );
  }

  private async outputChromeCss(
    sourcePath: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'absolute' | 'relative'>,
    distFilepath: FilePath<'absolute'>,
  ) {
    let result = this.bundler.getBuildResultFromPath(sourcePath);

    if (result === undefined) {
      await this.bundler.compileForce(this.bundler.getInternalHashFromPath(sourcePath));
      result = this.bundler.getBuildResultFromPath(sourcePath);
    }

    const extChanged = this.changeExt(sourcePath, 'css');
    const endemicHash = MurmurHash3.x86.hash32(sourcePath).toString();

    const fileName = (endemicHash + '_' + extChanged) as FilePath<'relative'>;

    const outputPath = absoluteGuard(resolve(distFilepath, fileName));

    if (result !== undefined) {
      this.logger.dispatchDebug(
        `👋 Output a css to dist. ${chalk.gray(`${sourcePath}" -> "${outputPath}`)}`,
      );
      await fsExtra.outputFile(outputPath, result);
      this.manifestFactory.resolve(sourceFilePathInManifest, fileName);
    }
  }

  /**
   * Include isolated connector
   */
  private async outputIsolatedConnector() {
    const {
      output,
      server: { host, websocket },
    } = this.configLoader.useConfig();

    if (output.chrome === undefined || host === undefined || websocket === undefined) {
      throw new Error('');
    }

    const configPath = this.configLoader.useConfigPath();
    const chromeOutputPath = absoluteGuard(resolve(dirname(configPath), output.chrome));

    let includeConnector = false;
    const isolatedmatches: string[] = [];

    this.manifestFactory.rawManifest.content_scripts.forEach(
      ({ use_isolated_connection, matches }) => {
        if (use_isolated_connection) {
          isolatedmatches.push(...(matches !== undefined ? matches : []));
          includeConnector = true;
        }
      },
    );

    if (includeConnector) {
      const isoFileName = 'crxm-isolated-connector.js';
      const isoConnectorPath = absoluteGuard(resolve(chromeOutputPath, isoFileName));
      await fsExtra.outputFile(
        isoConnectorPath,
        `${stringifyFunction(isolatedConnector, [this.buildId, JSON.stringify(this.configLoader.useConfig())])}\n`,
      );
      this.manifestFactory.addContentScript(
        [isoFileName],
        [],
        [...isolatedmatches],
        'ISOLATED',
        'document_start',
      );
    }
  }

  private async userjsBundle(distPath: FilePath<'absolute'>) {
    const {
      resources: {
        scriptResources,
        raw,
        cssResources,
        htmlResources: { popup },
      },
    } = this.manifestParser.parseResult;

    const { popup_in_userscript } = this.configLoader.useConfig();
    const { isUsingTrustedScripts } = this.manifestParser.parseResult;

    scriptResources.content.forEach((path, i) => {
      const result = this.bundler.getBuildResultFromPath(path);

      if (result !== undefined) {
        this.userscriptBundler.addBuildResult(raw.scriptResources.content[i], result);
      }
    });

    cssResources.forEach((path, i) => {
      const result = this.bundler.getBuildResultFromPath(path);

      if (result !== undefined) {
        this.userscriptBundler.addStyle(raw.cssResources[i], result, isUsingTrustedScripts);
      }
    });

    /**
     * Popup inject
     */
    if (popup_in_userscript) {
      if (popup.length === 0) {
        throw new Error("Popup doesn't exist.");
      }

      const html = await this.popup.getHtmlInlined();
      const popupHtmlPath = popup[0];
      this.userscriptBundler.addPopup(popupHtmlPath, html);
    }

    const output = absoluteGuard(resolve(distPath));

    const bundleResult = this.userscriptBundler.createCode();

    if (bundleResult !== undefined) {
      const formated = await prettier.format(bundleResult, {
        format: true,
        parser: 'babel',
        semi: true,
      });

      await fsExtra.outputFile(output, formated);
    }

    if (this.isWatch) {
      const code = this.createDev.outputDevelopmentUserjs();
      const output = resolve(dirname(distPath), 'dev.user.js');
      await fsExtra.outputFile(output, code);
    }

    this.logger.dispatchDebug(`👋 Output a userjs to dist. ${chalk.gray(`"${output}"`)}`);
  }

  private async copyPublicDir(distPath: FilePath<'absolute'>) {
    const { public: publicDir } = this.configLoader.useConfig();

    if (publicDir !== undefined && publicDir !== false) {
      await fsExtra.copy(publicDir, resolve(distPath, this.publicDirInDist), {
        overwrite: true,
      });
    }
  }

  private async copyIcons(distPath: FilePath<'absolute'>) {
    const { icons } = this.manifestParser.parseResult;
    if (icons !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Object.entries(icons).map(async ([_key, { raw, path }]) => {
          const fileName = basename(path) as FilePath<'relative'>;
          const output = absoluteGuard(
            resolve(distPath, `${this.publicDirInDist}/icons/`, fileName),
          );
          await fsExtra.copy(path, output);

          const iconPath = (`${this.publicDirInDist}/icons/` + fileName) as FilePath<'relative'>;
          this.manifestFactory.resolve(raw, iconPath);
        }),
      );
    }
  }
}

interface Define {
  name: string;
  value: string;
}
type Defines = Record<'content' | 'sw' | 'popup', Define[]>;
