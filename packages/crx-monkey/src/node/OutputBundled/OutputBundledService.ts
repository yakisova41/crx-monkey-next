import { inject, injectable } from 'inversify';
import type { I_ConfigLoader } from '../ConfigLoader';
import { TYPES } from '../types';
import type { Defines } from '../BundlerRegisterer';
import type { I_OutputChromeService } from './OutputChrome/OutputChromeService';
import { toAbsolute } from '../file';
import type { I_OutputUserjsService } from './OutputUserjs/OutputUserjsService';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import type { I_Popup } from '../popup/Popup';
import type { I_FileSystem } from '../FileSystem';
import type { FilePath } from '../typeDefs';
import type { I_ManifestParser } from '../manifest/ManifestParser';

/**
 * Output to a dist dir files bundled by the build system
 *
 * Old name:`Distributior`
 */
@injectable()
export class OutputBundledService {
  constructor(
    @inject(TYPES.ConfigLoader) private readonly configLoader: I_ConfigLoader,
    @inject(TYPES.OutputChromeService) public readonly outputChromeService: I_OutputChromeService,
    @inject(TYPES.OutputUserjsService) public readonly outputUserjsService: I_OutputUserjsService,
    @inject(TYPES.FileSystem) private readonly fileSystem: I_FileSystem,
    @inject(TYPES.Popup) private readonly popup: I_Popup,
    @inject(TYPES.ManifestParser) private readonly manifestParser: I_ManifestParser,
  ) {}

  private _defines: Defines = {
    content: [],
    sw: [],
    popup: [],
  };

  public async cleanupDist() {
    const { output } = this.configLoader.useConfig();
    if (output.chrome !== undefined) {
      const projectDir = dirname(this.configLoader.useConfigPath());
      const dist = resolve(projectDir, output.chrome);
      const projectFromDist = relative(dist, projectDir);
      if (
        projectFromDist === '' ||
        (!isAbsolute(projectFromDist) &&
          projectFromDist !== '..' &&
          !projectFromDist.startsWith('..' + sep))
      ) {
        throw new Error('Chrome output directory must not contain the project configuration.');
      }
      await this.fileSystem.remove(dist);
    }
  }

  public async outputAll() {
    const config = this.configLoader.useConfig();
    const { output, popup_in_userscript } = config;
    const configDir = dirname(this.configLoader.useConfigPath());

    if (output.chrome !== undefined) {
      // Enabled that building chrome ext.
      const dist = toAbsolute(resolve(configDir, output.chrome));

      await this.outputChromeService.outputAll(dist, this._defines, config, configDir);
    }

    if (output.userjs !== undefined) {
      // Enabled that building userjs.
      const dist = toAbsolute(resolve(configDir, output.userjs));

      await this.outputUserjsService.outputUserjsBundled(
        dist,
        this._defines.content,
        popup_in_userscript,
      );
    }
  }

  public async outputContentScript(entryPoint: FilePath<'absolute'>): Promise<void> {
    const dist = this.getOutputPath('chrome');
    if (dist === undefined) return;

    const { scriptResources, raw } = this.manifestParser.parseResult.resources;
    const index = scriptResources.content.indexOf(entryPoint);
    if (index === -1) {
      throw new Error(`Content script "${entryPoint}" is not registered in the manifest.`);
    }
    await this.outputChromeService.outputContentScript(
      entryPoint,
      raw.scriptResources.content[index],
      dist,
      this._defines.content,
    );
    await this.outputChromeService.outputManifest(dist);
  }

  public async outputCss(entryPoint: FilePath<'absolute'>): Promise<void> {
    const dist = this.getOutputPath('chrome');
    if (dist === undefined) return;

    const { cssResources, raw } = this.manifestParser.parseResult.resources;
    const index = cssResources.indexOf(entryPoint);
    if (index === -1) {
      throw new Error(`CSS "${entryPoint}" is not registered in the manifest.`);
    }
    await this.outputChromeService.outputCss(entryPoint, raw.cssResources[index], dist);
    await this.outputChromeService.outputManifest(dist);
  }

  public async outputServiceWorker(entryPoint: FilePath<'absolute'>): Promise<void> {
    const dist = this.getOutputPath('chrome');
    if (dist === undefined) return;

    const { scriptResources } = this.manifestParser.parseResult.resources;
    if (scriptResources.sw[0] !== entryPoint) {
      throw new Error(`Service worker "${entryPoint}" is not registered in the manifest.`);
    }
    await this.outputChromeService.outputServiceWorker(dist, this._defines.sw);
    await this.outputChromeService.outputManifest(dist);
  }

  public async outputPopup(entryPoint: FilePath<'absolute'>): Promise<void> {
    const dist = this.getOutputPath('chrome');
    if (dist === undefined) return;

    const { htmlResources } = this.manifestParser.parseResult.resources;
    if (htmlResources.popup.includes(entryPoint)) {
      await this.popup.register(entryPoint);
      await this.outputChromeService.outputPopup(dist, this._defines.popup);
      await this.outputChromeService.outputManifest(dist);
      return;
    }

    const resources = await this.popup.getExtensionResources();
    const resource = resources.find(({ target }) => target.entryPoint === entryPoint);
    if (resource === undefined) {
      throw new Error(`Popup resource "${entryPoint}" is not registered.`);
    }
    if (resource.target.flag === 'html_script') {
      await this.outputChromeService.outputPopupScript(entryPoint, dist, this._defines.popup);
    } else {
      await this.outputChromeService.outputPopupCss(entryPoint, dist);
    }
  }

  public async outputUserjs(): Promise<void> {
    const destination = this.getOutputPath('userjs');
    if (destination === undefined) return;

    const { popup_in_userscript } = this.configLoader.useConfig();
    await this.outputUserjsService.outputUserjsBundled(
      destination,
      this._defines.content,
      popup_in_userscript,
    );
  }

  private getOutputPath(target: 'chrome' | 'userjs'): FilePath<'absolute'> | undefined {
    const destination = this.configLoader.useConfig().output[target];
    if (destination === undefined) return;

    return toAbsolute(resolve(dirname(this.configLoader.useConfigPath()), destination));
  }

  public setDefines(defines: Defines) {
    this._defines = defines;
  }
}

export interface I_OutputBundledService {
  outputContentScript(entryPoint: FilePath<'absolute'>): Promise<void>;
  outputCss(entryPoint: FilePath<'absolute'>): Promise<void>;
  outputServiceWorker(entryPoint: FilePath<'absolute'>): Promise<void>;
  outputPopup(entryPoint: FilePath<'absolute'>): Promise<void>;
  outputUserjs(): Promise<void>;
  cleanupDist(): Promise<void>;
  outputAll(): Promise<void>;
  setDefines(defines: Defines): void;
}
