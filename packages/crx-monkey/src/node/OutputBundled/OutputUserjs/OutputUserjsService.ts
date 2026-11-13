import type { I_Popup } from '../../popup/Popup';
import { inject, injectable } from 'inversify';
import type { FilePath, I_CrxmBundler } from '../../typeDefs';
import { TYPES } from '../../types';
import type { I_FileSystem } from '../../FileSystem';
import type { Define } from '../../BundlerRegisterer';
import type { I_ManifestParser } from '../../manifest/ManifestParser';
import type { I_Logger } from '../../Logger';
import chalk from 'chalk';
import type { I_UserscriptBundler } from '../../userscript/UserscriptBundler';
import prettier from 'prettier';

@injectable()
export class OutputUserjsService implements I_OutputUserjsService {
  constructor(
    @inject(TYPES.CrxmBundler) private readonly bundler: I_CrxmBundler,
    @inject(TYPES.FileSystem) private readonly fileSystem: I_FileSystem,
    @inject(TYPES.ManifestParser) private readonly manifestParser: I_ManifestParser,
    @inject(TYPES.Logger) private readonly logger: I_Logger,
    @inject(TYPES.Popup) private readonly popup: I_Popup,
    @inject(TYPES.UserscriptBundler) private readonly userscriptBundler: I_UserscriptBundler,
  ) {}

  public async outputUserjsBundled(
    destinationFilePath: FilePath<'absolute'>,
    define: Define[],
    popup_in_userscript: boolean,
  ) {
    const {
      resources: {
        scriptResources,
        raw,
        cssResources,
        htmlResources: { popup },
      },
    } = this.manifestParser.parseResult;

    const { isUsingTrustedScripts } = this.manifestParser.parseResult;

    await Promise.all([
      ...scriptResources.content.map(async (path, i) => {
        let result = this.bundler.getBuildResultFromPath(path);

        if (result === undefined) {
          result = await this.rebuild(path);
        }

        this.userscriptBundler.addBuildResult(raw.scriptResources.content[i], result, define);
      }),

      ...cssResources.map(async (path, i) => {
        let result = this.bundler.getBuildResultFromPath(path);

        if (result === undefined) {
          result = await this.rebuild(path);
        }

        this.userscriptBundler.addStyle(raw.cssResources[i], result, isUsingTrustedScripts);
      }),
    ]);

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

    const bundleResult = this.userscriptBundler.createCode();

    if (bundleResult !== undefined) {
      const formated = await prettier.format(bundleResult, {
        format: true,
        parser: 'babel',
        semi: true,
      });

      await this.fileSystem.outputFile(destinationFilePath, formated);
    }

    this.logger.dispatchDebug(
      `👋 Output a userjs to dist. ${chalk.gray(`"${destinationFilePath}"`)}`,
    );
  }

  private async rebuild(sourceFilePath: FilePath<'absolute'>) {
    // May the source no bundled yet or the source is not contained?

    // Get the key for this source used in bundle.
    const i = this.bundler.getInternalHashFromPath(sourceFilePath, null);

    await this.bundler.compileForce(i);

    const result = this.bundler.getBuildResultFromPath(sourceFilePath);

    if (result === undefined) {
      throw new Error(`File "${sourceFilePath}" is not a build target.`);
    }

    return result;
  }
}

export interface I_OutputUserjsService {
  outputUserjsBundled(
    destinationFilePath: FilePath<'absolute'>,
    define: Define[],
    popup_in_userscript: boolean,
  ): Promise<void>;
}
