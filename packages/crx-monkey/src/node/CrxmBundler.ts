import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import { dirname, resolve } from 'path';
import { resolveFilePath } from './file';
import fse from 'fs-extra';
import { ConfigLoader } from './ConfigLoader';
import {
  BuildTarget,
  CrxmBundlerPlugin,
  CrxmBundlerPluginWatch,
  CrxmBundlerPluginWatcher,
  I_CrxmBundler,
  ScriptUpdateHandler,
} from 'src/client/typeDefs';
import chalk from 'chalk';
import { Logger } from './Logger';

/**
 * Manage all bundler
 */
@injectable()
export class CrxmBundler implements I_CrxmBundler {
  private targets: Record<string, BuildTarget> = {};
  private _compileResults: Record<string, Uint8Array> = {};
  private watchers: CrxmBundlerPluginWatcher[] = [];
  private updateHandlers: ScriptUpdateHandler[] = [];

  constructor(
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {}

  public get compileResults() {
    return this._compileResults;
  }

  public addTarget(
    entryPoint: string,
    usingPlugin: { build: CrxmBundlerPlugin; watch: CrxmBundlerPluginWatch[] },
    flag: string = '',
  ) {
    const hash = crypto.randomUUID();
    this.targets[hash] = { entryPoint, usingPlugin, hash, flag };
    return hash;
  }

  public removeTarget(targetEntryPoint: string, flag: string | null = null) {
    const hash = this.getInternalHashFromPath(targetEntryPoint, flag);

    delete this.targets[hash];
  }

  public getInternalHashFromPath(filePath: string, targetFlag: string | null = null) {
    let hash: string;

    if (targetFlag !== null) {
      // flag filter
      hash = Object.keys(this.targets).filter((hash) => {
        const { entryPoint, flag } = this.targets[hash];
        return entryPoint === filePath && flag === targetFlag;
      })[0];
    } else {
      hash = Object.keys(this.targets).filter((hash) => {
        const { entryPoint } = this.targets[hash];
        return entryPoint === filePath;
      })[0];
    }

    return hash;
  }

  public getBuildResultFromPath(filePath: string): Uint8Array | undefined {
    const hash = this.getInternalHashFromPath(filePath);
    return this._compileResults[hash];
  }

  public async build() {
    await this.compileAll();
  }

  /**
   * Watching scripts
   */
  public async watch() {
    if (this.watchers?.length !== 0) {
      throw new Error('Script watching must be started after stopping before watching');
    }
    await this.watchAll();
  }

  /**
   * Stop watching scripts
   */
  public async stopWatch() {
    await Promise.all(
      this.watchers.map(async (watcher) => {
        await watcher.stop();
      }),
    );

    this.watchers = [];
  }

  /**
   * Register the handler be runned when scripts updated.
   * @param handler
   */
  public addListener(handler: ScriptUpdateHandler) {
    this.updateHandlers.push(handler);
  }

  /**
   * Remove the handler be runned when scripts updated.
   * @param handler
   */
  public removeListener(handler: ScriptUpdateHandler) {
    const newHandlers = this.updateHandlers.filter((h) => h !== handler);

    this.updateHandlers = newHandlers;
  }

  /**
   * Start watching for all sources by using plugins.
   */
  private async watchAll() {
    const watchers: CrxmBundlerPluginWatcher[] = [];
    const absolutePaths = await this.getTargetAbsolutePaths();

    await Promise.all(
      Object.keys(absolutePaths).map(async (hash) => {
        const absolutePath = resolveFilePath(absolutePaths[hash]);
        const { usingPlugin } = this.targets[hash];

        const resultSender = (result: Uint8Array) => {
          this.logger.dispatchDebug(`✨ Builded ${chalk.gray('"' + absolutePath + '"')}`);

          // Register result.
          this._compileResults[hash] = result;

          // Dispatch update
          this.updateHandlers.forEach((h) => {
            h(this.targets[hash]);
          });
        };

        if (await fse.exists(absolutePath)) {
          watchers.push(
            ...(await Promise.all(
              usingPlugin.watch.map(async (plugin) => {
                return await plugin(absolutePath, resultSender, this);
              }),
            )),
          );
        } else {
          throw new Error(`Entrypoint '${absolutePath} does not exist.'`);
        }
      }),
    );

    this.watchers = watchers;
  }

  public async compileForce(hash: string) {
    const target = this.targets[hash];
    const absolutePaths = await this.getTargetAbsolutePaths();

    const absolutePath = resolveFilePath(absolutePaths[hash]);

    this._compileResults[hash] = await target.usingPlugin.build(absolutePath, this);
    return target;
  }

  /**
   * Compile all sources by using plugins.
   */
  private async compileAll() {
    const compileResults: Record<string, Uint8Array> = {};

    const absolutePaths = await this.getTargetAbsolutePaths();

    await Promise.all(
      Object.keys(absolutePaths).map(async (hash) => {
        const absolutePath = resolveFilePath(absolutePaths[hash]);
        const { usingPlugin } = this.targets[hash];

        if (await fse.exists(absolutePath)) {
          compileResults[hash] = await usingPlugin.build(absolutePath, this);
        } else {
          throw new Error(`Entrypoint '${absolutePath} does not exist.'`);
        }
      }),
    );

    this._compileResults = compileResults;
    return;
  }

  /**
   * Get the file's which in the project absolute path.
   * @returns
   */
  private async getTargetAbsolutePaths() {
    const path = this.configLoader.useConfigPath();
    const projectDir = dirname(path);

    const paths: Record<string, string> = {};
    Object.keys(this.targets).map((hash) => {
      const { entryPoint } = this.targets[hash];
      paths[hash] = resolve(projectDir, entryPoint);
    });

    return paths;
  }
}
