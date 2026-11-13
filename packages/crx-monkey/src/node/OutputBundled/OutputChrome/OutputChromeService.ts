import type { I_Popup } from '../../popup/Popup';
import { inject, injectable } from 'inversify';
import { basename, resolve } from 'path';
import type { CrxmConfigRequired, FilePath, I_CrxmBundler } from '../../typeDefs';
import { TYPES } from '../../types';
import MurmurHash3 from 'murmurhash3js';
import { absoluteGuard, toAbsolute } from '../../file';
import type { I_FileSystem } from '../../FileSystem';
import { changeExt, createDefinedCode, crxmVarinjection } from '../utils';
import type { Define, Defines } from '../../BundlerRegisterer';
import type { I_ManifestParser } from '../../manifest/ManifestParser';
import type { I_ManifestFactory } from '../../manifest/ManifestFactory';
import type { I_Logger } from '../../Logger';
import chalk from 'chalk';
import { isolatedConnector } from '../../isolatedConnector';
import { stringifyFunction } from '../../utils';

@injectable()
export class OutputChromeService implements I_OutputChromeService {
  private readonly publicDirName = 'public';

  constructor(
    @inject(TYPES.CrxmBundler) private readonly bundler: I_CrxmBundler,
    @inject(TYPES.FileSystem) private readonly fileSystem: I_FileSystem,
    @inject(TYPES.BuildID) private readonly buildId: string,
    @inject(TYPES.ManifestParser) private readonly manifestParser: I_ManifestParser,
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: I_ManifestFactory,
    @inject(TYPES.Logger) private readonly logger: I_Logger,
    @inject(TYPES.Popup) private readonly popup: I_Popup,
  ) {}

  public async outputAll(
    dist: FilePath<'absolute'>,
    defines: Defines,
    config: CrxmConfigRequired,
    configDir: string,
  ): Promise<void> {
    await this.outputAllContentScripts(dist, defines.content);
    await this.outputServiceWorker(dist, defines.sw);
    await this.outputPopup(dist, defines.popup);
    await this.outputAllCss(dist);

    await this.copyPublicDir(dist, configDir, config.public);
    await this.outputIcons(dist);
    await this.outputIsolatedConnector(dist, config);
    await this.outputManifest(dist);
  }

  private async outputAllContentScripts(
    destinationFilePath: FilePath<'absolute'>,
    define: Define[],
  ) {
    const { scriptResources, raw } = this.manifestParser.parseResult.resources;

    await Promise.all(
      scriptResources.content.map(async (path, i) => {
        const pathInManifest = raw.scriptResources.content[i];

        await this.outputContentScript(path, pathInManifest, destinationFilePath, define);
      }),
    );
  }

  public async outputContentScript(
    sourceFilePathAbsolute: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'relative' | 'absolute'>,
    destinationFilePath: FilePath<'absolute'>,
    define: Define[],
  ) {
    const { fileName, outputPath } = await this.outputFileBundled(
      sourceFilePathAbsolute,
      destinationFilePath,
      define,
      true,
      'js',
      'chrome-content',
    );

    this.manifestFactory.resolve(sourceFilePathInManifest, fileName);
    this.logger.dispatchDebug(
      `👋 Output a contentscript to dist. ${chalk.gray(`${sourceFilePathInManifest}" -> "${outputPath}`)}`,
    );
  }

  public async outputServiceWorker(destinationFilePath: FilePath<'absolute'>, define: Define[]) {
    const { scriptResources, raw } = this.manifestParser.parseResult.resources;

    if (scriptResources.sw.length === 0) {
      return;
    }

    const { fileName, outputPath } = await this.outputFileBundled(
      scriptResources.sw[0],
      destinationFilePath,
      define,
      true,
      'js',
      'chrome-sw',
    );

    this.manifestFactory.resolve(raw.scriptResources.sw[0], fileName);
    this.logger.dispatchDebug(
      `👋 Output a service worker to dist. ${chalk.gray(`${raw.scriptResources.sw[0]}" -> "${outputPath}`)}`,
    );
  }

  public async outputPopup(destination: FilePath<'absolute'>, define: Define[]) {
    if (this.manifestParser.parseResult.resources.htmlResources.popup.length === 0) {
      return;
    }
    const resources = await this.popup.getExtensionResources();
    await Promise.all(
      resources.map(async ({ target: { entryPoint, flag } }) => {
        if (flag === 'html_script') {
          await this.outputPopupScript(entryPoint, destination, define);
        } else {
          await this.outputPopupCss(entryPoint, destination);
        }
      }),
    );
    await this.outputPopupHtml(destination);
  }

  public async outputPopupScript(
    entryPoint: FilePath<'absolute'>,
    destination: FilePath<'absolute'>,
    define: Define[],
  ): Promise<void> {
    await this.outputFileBundled(entryPoint, destination, define, true, 'js', 'chrome-html_script');
    this.logger.dispatchDebug(`👋 Output a popup js to dist. ${chalk.gray(`"${destination}"`)}`);
  }

  public async outputPopupCss(
    entryPoint: FilePath<'absolute'>,
    destination: FilePath<'absolute'>,
  ): Promise<void> {
    await this.outputFileBundled(entryPoint, destination, [], false, 'css');
    this.logger.dispatchDebug(`👋 Output a popup css to dist. ${chalk.gray(`"${destination}"`)}`);
  }

  public async outputPopupHtml(destination: FilePath<'absolute'>): Promise<void> {
    await this.popup.refreshExtensionParser();
    const resources = await this.popup.getExtensionResources();
    for (const { target, resolveTarget } of resources) {
      const ext = target.flag === 'html_script' ? 'js' : 'css';
      resolveTarget(this.makeNewFileName(target.entryPoint, ext));
    }

    const { contents, outputPath, resolveManifest } = await this.popup.getHTML();
    const destinationPath = resolve(destination, basename(outputPath));
    await this.fileSystem.outputFile(destinationPath, contents);
    resolveManifest();
    this.logger.dispatchDebug(
      `👋 Output a popup html to dist. ${chalk.gray(`"${destinationPath}"`)}`,
    );
  }

  private async outputAllCss(destination: FilePath<'absolute'>) {
    const { cssResources, raw } = this.manifestParser.parseResult.resources;
    await Promise.all(
      cssResources.map(async (path, index) => {
        await this.outputCss(path, raw.cssResources[index], destination);
      }),
    );
  }

  public async outputCss(
    sourcePath: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'absolute' | 'relative'>,
    destination: FilePath<'absolute'>,
  ) {
    const { fileName, outputPath } = await this.outputFileBundled(
      sourcePath,
      destination,
      [],
      false,
      'css',
    );
    this.manifestFactory.resolve(sourceFilePathInManifest, fileName);

    this.logger.dispatchDebug(`👋 Output a css to dist. ${chalk.gray(`"${outputPath}"`)}`);
  }

  private async outputIsolatedConnector(
    destination: FilePath<'absolute'>,
    config: CrxmConfigRequired,
  ) {
    const scripts = this.manifestFactory.rawManifest.content_scripts.filter(
      ({ use_isolated_connection }) => use_isolated_connection,
    );
    if (scripts.length === 0) {
      return;
    }

    const fileName = 'crxm-isolated-connector.js';
    const code = stringifyFunction(isolatedConnector, [this.buildId, JSON.stringify(config)]);
    await this.fileSystem.outputFile(resolve(destination, fileName), code + '\n');
    this.manifestFactory.addContentScript(
      [fileName],
      [],
      scripts.flatMap(({ matches }) => matches ?? []),
      'ISOLATED',
      'document_start',
    );
  }

  private async outputFileBundled(
    sourceFilePath: FilePath<'absolute'>,
    destinationFilePath: FilePath<'absolute'>,
    define: Define[],
    isScript: boolean,
    ext: string,
    env?: string,
  ): Promise<{
    outputPath: FilePath<'absolute'>;
    data: string | Uint8Array;
    fileName: FilePath<'relative'>;
  }> {
    let result = this.bundler.getBuildResultFromPath(sourceFilePath);

    if (result === undefined) {
      // May the source no bundled yet or the source is not contained?

      // Get the key for this source used in bundle.
      const i = this.bundler.getInternalHashFromPath(sourceFilePath, null);

      await this.bundler.compileForce(i);

      result = this.bundler.getBuildResultFromPath(sourceFilePath);

      if (result === undefined) {
        throw new Error(`File "${sourceFilePath}" is not a build target.`);
      }
    }

    const fileName = this.makeNewFileName(sourceFilePath, ext);

    const outputPath = toAbsolute(resolve(destinationFilePath, fileName));

    if (isScript) {
      // Inject defines
      if (env === undefined) {
        throw new Error("'env' has not been specified, even though 'isScript' is set to true.");
      }

      const crxmVarInjected = crxmVarinjection(result, this.buildId, env);
      const definesInjected = createDefinedCode(crxmVarInjected, define);
      await this.fileSystem.outputFile(outputPath, definesInjected);
      return {
        outputPath,
        data: definesInjected,
        fileName,
      };
    } else {
      await this.fileSystem.outputFile(outputPath, result);
      return {
        outputPath,
        data: result,
        fileName,
      };
    }
  }

  private makeNewFileName(sourceFilePath: FilePath<'absolute'>, ext: string) {
    const extChanged = changeExt(sourceFilePath, ext);
    const hash = MurmurHash3.x86.hash32(sourceFilePath).toString();
    const fileName = (hash + '_' + extChanged) as FilePath<'relative'>;

    return fileName;
  }

  /**
   * Output manifest file.
   * This operation must be used after all transpiling.
   * @param outputPath
   */
  public async outputManifest(outputPath: FilePath<'absolute'>) {
    const manifest = this.manifestFactory.getWorkspace();
    await this.fileSystem.outputFile(
      resolve(outputPath, 'manifest.json'),
      JSON.stringify(manifest, undefined, 2),
    );
  }

  public async copyPublicDir(
    distPath: FilePath<'absolute'>,
    configDir: string,
    publicDir: CrxmConfigRequired['public'],
  ) {
    if (publicDir !== undefined && publicDir !== false) {
      await this.fileSystem.copy(
        resolve(configDir, publicDir),
        resolve(distPath, this.publicDirName),
        { overwrite: true },
      );
    }
  }

  public async outputIcons(distPath: FilePath<'absolute'>) {
    const publicDirName = this.publicDirName;
    const { icons } = this.manifestParser.parseResult;
    if (icons !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        Object.entries(icons).map(async ([_key, { raw, path }]) => {
          const fileName = basename(path) as FilePath<'relative'>;
          const output = absoluteGuard(resolve(distPath, `${publicDirName}/icons/`, fileName));
          await this.fileSystem.copy(path, output);

          const iconPath = (`${publicDirName}/icons/` + fileName) as FilePath<'relative'>;
          this.manifestFactory.resolve(raw, iconPath);
        }),
      );
    }
  }
}

export interface I_OutputChromeService {
  outputPopupScript(
    entryPoint: FilePath<'absolute'>,
    destination: FilePath<'absolute'>,
    define: Define[],
  ): Promise<void>;
  outputPopupCss(
    entryPoint: FilePath<'absolute'>,
    destination: FilePath<'absolute'>,
  ): Promise<void>;
  outputPopupHtml(destination: FilePath<'absolute'>): Promise<void>;
  outputAll(
    dist: FilePath<'absolute'>,
    defines: Defines,
    config: CrxmConfigRequired,
    configDir: string,
  ): Promise<void>;

  outputContentScript(
    sourceFilePathAbsolute: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'relative' | 'absolute'>,
    destinationFilePath: FilePath<'absolute'>,
    define: Define[],
  ): Promise<void>;

  outputServiceWorker(destinationFilePath: FilePath<'absolute'>, define: Define[]): Promise<void>;

  outputPopup(destinationFilePath: FilePath<'absolute'>, define: Define[]): Promise<void>;

  outputCss(
    sourcePath: FilePath<'absolute'>,
    sourceFilePathInManifest: FilePath<'absolute' | 'relative'>,
    destination: FilePath<'absolute'>,
  ): Promise<void>;

  outputManifest(outputPath: FilePath<'absolute'>): Promise<void>;

  outputIcons(distPath: FilePath<'absolute'>): Promise<void>;

  copyPublicDir(
    distPath: FilePath<'absolute'>,
    configDir: string,
    publicDir: CrxmConfigRequired['public'],
  ): Promise<void>;
}
