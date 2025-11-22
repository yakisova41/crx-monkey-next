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

@injectable()
export class Distributior {
  constructor(
    @inject(TYPES.CrxmBundler) private readonly bundler: CrxmBundler,
    @inject(TYPES.ManifestLoader) private readonly manifestLoader: ManifestLoader,
    @inject(TYPES.ManifestParser) private readonly manifestParser: ManifestParser,
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.UserscriptBundler) private readonly userscriptBundler: UserscriptBundler,
    @inject(TYPES.CreateDevClient) private readonly createDev: CreateDevClient,
    @inject(TYPES.IsWatch) private readonly isWatch: boolean,
    @inject(TYPES.BuildID) private readonly buildId: string,
  ) {}

  /**
   * Output bundled file
   * This must be used after bundled.
   */
  public dist() {
    this.outputBundled();
    //this.copyAssetsDir();
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

  /**
   * Output bundled file
   */
  private outputBundled() {
    const { output } = this.configLoader.useConfig();

    if (output.chrome !== undefined) {
      this.chromeBundle(output.chrome);
      this.copyPublicDir(output.chrome);
      this.copyIcons(output.chrome);
      this.outputManifest(output.chrome);
    }

    if (output.userjs !== undefined) {
      this.userjsBundle(output.userjs);
    }
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
  private outputManifest(outputPath: string) {
    const manifest = this.manifestFactory.getWorkspace();
    fsExtra.outputFileSync(
      resolve(outputPath, 'manifest.json'),
      JSON.stringify(manifest, undefined, 2),
    );
  }

  /**
   * Output for chrome
   * @param distPath
   */
  private chromeBundle(distPath: string) {
    const {
      resources: {
        scriptResources,
        cssResources,
        htmlResources: { popup },
        raw,
      },
    } = this.manifestParser.parseResult;

    scriptResources.content.forEach((path, i) => {
      const result = this.bundler.getBuildResultFromPath(path);

      if (result !== undefined) {
        const extChanged = this.changeExt(path, 'js');
        const endemicHash = MurmurHash3.x86.hash32(path).toString();

        const fileName = endemicHash + '_' + extChanged;

        const outputPath = resolve(distPath, fileName);

        const decoder = new TextDecoder();
        let code: string | Uint8Array = result;

        if (this.isWatch) {
          code = `window.__CRX_CONTENT_BUILD_ID = '${this.buildId}';\n` + decoder.decode(result);
        }

        fsExtra.outputFileSync(outputPath, code);
        this.manifestFactory.resolve(raw.scriptResources.content[i], fileName);
      }
    });

    scriptResources.sw.forEach((path, i) => {
      const buildResult = this.bundler.getBuildResultFromPath(path);

      const extChanged = this.changeExt(path, 'js');
      const endemicHash = MurmurHash3.x86.hash32(path).toString();

      const fileName = endemicHash + '_' + extChanged;

      const outputPath = resolve(distPath, fileName);

      if (buildResult !== undefined) {
        let result: string | Uint8Array = buildResult;

        if (this.isWatch) {
          result = this.createDev.outputDevelomentSw(buildResult);
        }

        fsExtra.outputFileSync(outputPath, result);
        this.manifestFactory.resolve(raw.scriptResources.sw[i], fileName);
      }
    });

    cssResources.forEach((path, i) => {
      const result = this.bundler.getBuildResultFromPath(path);

      const extChanged = this.changeExt(path, 'css');
      const endemicHash = MurmurHash3.x86.hash32(path).toString();

      const fileName = endemicHash + '_' + extChanged;

      const outputPath = resolve(distPath, fileName);

      if (result !== undefined) {
        fsExtra.outputFileSync(outputPath, result);
        this.manifestFactory.resolve(raw.cssResources[i], fileName);
      }
    });

    popup.forEach((path, i) => {
      const result = this.bundler.getBuildResultFromPath(path);
      const endemicHash = MurmurHash3.x86.hash32(path).toString();
      const fileName = endemicHash + '.html';
      const outputPath = resolve(distPath, fileName);

      if (result !== undefined) {
        fsExtra.outputFileSync(outputPath, result);
        this.manifestFactory.resolve(raw.htmlResources.popup[i], fileName);
      }
    });
  }

  private async userjsBundle(distPath: string) {
    const {
      resources: { scriptResources, raw },
    } = this.manifestParser.parseResult;

    scriptResources.content.forEach((path, i) => {
      const result = this.bundler.getBuildResultFromPath(path);

      if (result !== undefined) {
        this.userscriptBundler.addBuildResult(raw.scriptResources.content[i], result);
      }
    });

    const output = resolve(distPath);

    const bundleResult = this.userscriptBundler.createCode();
    if (bundleResult !== undefined) {
      const formated = await prettier.format(bundleResult, {
        format: true,
        parser: 'babel',
        semi: true,
      });

      fsExtra.outputFileSync(output, formated);
    }

    if (this.isWatch) {
      const code = this.createDev.outputDevelopmentUserjs();
      const output = resolve(dirname(distPath), 'dev.user.js');
      fsExtra.outputFileSync(output, code);
    }
  }

  private copyPublicDir(distPath: string) {
    const { public: publicDir } = this.configLoader.useConfig();

    if (publicDir !== undefined) {
      fsExtra.copySync(publicDir, resolve(distPath, 'public'), {
        overwrite: true,
      });
    }
  }

  private copyIcons(distPath: string) {
    const { icons } = this.manifestParser.parseResult;
    if (icons !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(icons).forEach(([key, { raw, path, size }]) => {
        const fileName = basename(path);
        const output = resolve(distPath, 'assets/icons', fileName);
        fsExtra.copySync(path, output);
        this.manifestFactory.resolve(raw, 'assets/icons/' + fileName);
      });
    }
  }
}
