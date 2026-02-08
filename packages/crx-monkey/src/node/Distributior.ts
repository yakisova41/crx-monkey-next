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
import { CreateDevClient, stringifyFunction } from './development/CreateDevClient';
import { isolatedConnector } from './isolatedConnector';
import { Logger } from './Logger';
import chalk from 'chalk';
import { Popup } from './popup/Popup';

@injectable()
export class Distributior {
  private defines: Defines = {
    content: [],
    sw: [],
    popup: [],
  };

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

  /**
   * Output bundled file
   * This must be used after bundled.
   */
  public async distAll() {
    const { output } = this.configLoader.useConfig();
    const {
      resources: { scriptResources, raw, htmlResources },
    } = this.manifestParser.parseResult;

    if (output.chrome !== undefined) {
      await this.outputAllChromeContentscripts(output.chrome);
      await this.outputAllChromeCss(output.chrome);
      if (scriptResources.sw.length !== 0) {
        await this.outputChromeSw(scriptResources.sw[0], raw.scriptResources.sw[0], output.chrome);
      }

      if (htmlResources.popup.length !== 0) {
        await this.popup.outputHtml();
      }

      await this.copyPublicDir(output.chrome);
      await this.copyIcons(output.chrome);
      await this.outputManifest(output.chrome);
      await this.outputIsolatedConnector();
    }

    if (output.userjs !== undefined) {
      await this.userjsBundle(output.userjs);
    }
  }

  public async dist(
    targetSourceAbsolutePath: string,
    type: 'content' | 'sw' | 'popup' | 'css' | 'userjs',
  ) {
    const { output } = this.configLoader.useConfig();
    const {
      resources: { scriptResources, raw, cssResources },
    } = this.manifestParser.parseResult;

    if (type === 'content') {
      await Promise.all(
        scriptResources.content.map(async (absolutePath, i) => {
          if (output.chrome !== undefined) {
            const pathInManifest = raw.scriptResources.content[i];

            await this.outputChromeContentScript(absolutePath, pathInManifest, output.chrome);
          }
        }),
      );
    }

    if (type === 'sw') {
      if (output.chrome !== undefined) {
        await this.outputChromeSw(
          targetSourceAbsolutePath,
          raw.scriptResources.sw[0],
          output.chrome,
        );
      }
    }

    if (type === 'popup') {
      if (output.chrome !== undefined) {
        await this.popup.outputHtml();
      }
    }

    if (type === 'css') {
      await Promise.all(
        cssResources.map(async (absolutePath, i) => {
          if (output.chrome !== undefined) {
            const pathInManifest = raw.cssResources[i];

            this.outputChromeCss(absolutePath, pathInManifest, output.chrome);
          }
        }),
      );
    }

    if (output.chrome !== undefined) {
      await this.outputManifest(output.chrome);
    }

    if (type === 'userjs') {
      if (output.userjs !== undefined) {
        await this.userjsBundle(output.userjs);
      }
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
    this.defines = {
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
    this.defines[to].push({ name, value });
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
  private changeExt(filePath: string, newExt: string) {
    const rawFileNameSplited = basename(filePath).split('.');
    rawFileNameSplited[rawFileNameSplited.length - 1] = newExt;
    const newFilename = rawFileNameSplited.join('.');
    return newFilename;
  }

  /**
   * Output manifest file.
   * This operation must be used after all transpiling.
   * @param outputPath
   */
  private async outputManifest(outputPath: string) {
    const manifest = this.manifestFactory.getWorkspace();
    await fsExtra.outputFile(
      resolve(outputPath, 'manifest.json'),
      JSON.stringify(manifest, undefined, 2),
    );
  }

  private async outputAllChromeContentscripts(distPath: string) {
    const {
      resources: { scriptResources, raw },
    } = this.manifestParser.parseResult;
    await Promise.all(
      scriptResources.content.map(async (path, i) => {
        await this.outputChromeContentScript(path, raw.scriptResources.content[i], distPath);
      }),
    );
  }

  private async outputChromeContentScript(
    sourceAbsolutePath: string,
    sourceFilePathInManifest: string,
    distFilepath: string,
  ) {
    let result = this.bundler.getBuildResultFromPath(sourceAbsolutePath);

    if (result === undefined) {
      await this.bundler.compileForce(this.bundler.getInternalHashFromPath(sourceAbsolutePath));
      result = this.bundler.getBuildResultFromPath(sourceAbsolutePath);
    }

    if (result !== undefined) {
      const extChanged = this.changeExt(sourceAbsolutePath, 'js');
      const endemicHash = MurmurHash3.x86.hash32(sourceAbsolutePath).toString();

      const fileName = endemicHash + '_' + extChanged;

      const outputPath = resolve(distFilepath, fileName);

      const decoder = new TextDecoder();

      const decorded = decoder.decode(result);

      let code: string | Uint8Array = this.createDefineCode(this.defines.content) + decorded;

      if (this.isWatch) {
        code = `window.__CRX_CONTENT_BUILD_ID = '${this.buildId}';\n` + code;
      }

      this.logger.dispatchDebug(
        `👋 Output a contentscript to dist. ${chalk.gray(`${sourceAbsolutePath}" -> "${outputPath}`)}`,
      );
      await fsExtra.outputFile(outputPath, code);

      this.manifestFactory.resolve(sourceFilePathInManifest, fileName);
    }
  }

  private async outputChromeSw(
    sourceAbsolutePath: string,
    sourceFilePathInManifest: string,
    distFilepath: string,
  ) {
    let buildResult = this.bundler.getBuildResultFromPath(sourceAbsolutePath);

    if (buildResult === undefined) {
      await this.bundler.compileForce(this.bundler.getInternalHashFromPath(sourceAbsolutePath));
      buildResult = this.bundler.getBuildResultFromPath(sourceAbsolutePath);
    }

    const extChanged = this.changeExt(sourceAbsolutePath, 'js');
    const endemicHash = MurmurHash3.x86.hash32(sourceAbsolutePath).toString();

    const fileName = endemicHash + '_' + extChanged;

    const outputPath = resolve(distFilepath, fileName);

    if (buildResult !== undefined) {
      let code: string;

      if (this.isWatch) {
        code =
          this.createDefineCode(this.defines.sw) + this.createDev.outputDevelomentSw(buildResult);
      } else {
        const decoder = new TextDecoder();
        code = this.createDefineCode(this.defines.sw) + decoder.decode(buildResult);
      }

      this.logger.dispatchDebug(
        `👋 Output a service worker to dist. ${chalk.gray(`${sourceAbsolutePath}" -> "${outputPath}`)}`,
      );
      await fsExtra.outputFile(outputPath, code);

      this.manifestFactory.resolve(sourceFilePathInManifest, fileName);
    }
  }

  private async outputAllChromeCss(distPath: string) {
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
    sourceAbsolutePath: string,
    sourceFilePathInManifest: string,
    distFilepath: string,
  ) {
    let result = this.bundler.getBuildResultFromPath(sourceAbsolutePath);

    if (result === undefined) {
      await this.bundler.compileForce(this.bundler.getInternalHashFromPath(sourceAbsolutePath));
      result = this.bundler.getBuildResultFromPath(sourceAbsolutePath);
    }

    const extChanged = this.changeExt(sourceAbsolutePath, 'css');
    const endemicHash = MurmurHash3.x86.hash32(sourceAbsolutePath).toString();

    const fileName = endemicHash + '_' + extChanged;

    const outputPath = resolve(distFilepath, fileName);

    if (result !== undefined) {
      this.logger.dispatchDebug(
        `👋 Output a css to dist. ${chalk.gray(`${sourceAbsolutePath}" -> "${outputPath}`)}`,
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
      output: { chrome },
      server: { host, websocket },
    } = this.configLoader.useConfig();

    if (chrome === undefined || host === undefined || websocket === undefined) {
      throw new Error('');
    }

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
      const isoConnectorPath = resolve(chrome, isoFileName);
      fsExtra.outputFile(
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

  private async userjsBundle(distPath: string) {
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

    const output = resolve(distPath);

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

  private async copyPublicDir(distPath: string) {
    const { public: publicDir } = this.configLoader.useConfig();

    if (publicDir !== undefined && publicDir !== false) {
      await fsExtra.copy(publicDir, resolve(distPath, 'public'), {
        overwrite: true,
      });
    }
  }

  private async copyIcons(distPath: string) {
    const { icons } = this.manifestParser.parseResult;
    if (icons !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Object.entries(icons).map(async ([_key, { raw, path }]) => {
          const fileName = basename(path);
          const output = resolve(distPath, 'assets/icons', fileName);
          await fsExtra.copy(path, output);
          this.manifestFactory.resolve(raw, 'assets/icons/' + fileName);
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
