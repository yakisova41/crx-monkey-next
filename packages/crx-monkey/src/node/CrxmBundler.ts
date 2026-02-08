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
} from 'src/node/typeDefs';
import chalk from 'chalk';
import { Logger } from './Logger';

/**
 * Manage all bundler
 */
@injectable()
export class CrxmBundler implements I_CrxmBundler {
  private _targets: Record<string, BuildTarget> = {};
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

  public get targets() {
    return this._targets;
  }

  public addTarget(
    entryPoint: string,
    usingPlugin: { build: CrxmBundlerPlugin; watch: CrxmBundlerPluginWatch },
    flag: string = '',
  ) {
    const hash = crypto.randomUUID();
    this._targets[hash] = { entryPoint, usingPlugin, hash, flag };

    return hash;
  }

  public removeTarget(targetEntryPoint: string, flag: string | null = null) {
    const hash = this.getInternalHashFromPath(targetEntryPoint, flag);

    delete this._targets[hash];
  }

  public getInternalHashFromPath(filePath: string, targetFlag: string | null = null) {
    let hash: string;

    if (targetFlag !== null) {
      // flag filter
      hash = Object.keys(this._targets).filter((hash) => {
        const { entryPoint, flag } = this._targets[hash];
        return entryPoint === filePath && flag === targetFlag;
      })[0];
    } else {
      hash = Object.keys(this._targets).filter((hash) => {
        const { entryPoint } = this._targets[hash];
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

    this.logger.dispatchDebugStack('Watch started');
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

    this.logger.dispatchDebugStack('Watch stopped');
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
    const absolutePaths = await this.getTargetAbsolutePaths();

    this.logger.dispatchDebug('Files:', absolutePaths);

    const hashs = Object.keys(absolutePaths);
    await Promise.all(
      Object.entries(hashs).map(async ([, hash]) => {
        const filePath = absolutePaths[hash];
        this.logger.dispatchDebug(filePath);

        await this.watchFile(hash);
      }),
    );
  }

  private async watchFile(hash: string) {
    const absolutePaths = await this.getTargetAbsolutePaths();

    const absolutePath = resolveFilePath(absolutePaths[hash]);
    const { usingPlugin } = this._targets[hash];

    if (await fse.exists(absolutePath)) {
      const { plugin, name } = usingPlugin.watch;

      const resultSender = (result: Uint8Array) => {
        this.logger.dispatchDebug(`✨ [${name}] Builded  ${chalk.gray('"' + absolutePath + '"')}`);

        // Register result.
        this._compileResults[hash] = result;

        // Dispatch update
        this.updateHandlers.forEach((handler) => {
          handler(this._targets[hash]);
        });
      };

      const watcher = await plugin(absolutePath, resultSender, this);
      this.watchers.push(watcher);

      this.logger.dispatchDebugStack(
        `🩹 [${name}] Registered plugin for  ${chalk.gray('"' + absolutePath + '"')}`,
      );
    } else {
      throw new Error(`Entrypoint '${absolutePath} does not exist.'`);
    }
  }

  public async compileForce(hash: string) {
    const target = this._targets[hash];

    if (target === undefined) {
      throw new Error(this.logger.dispatchErr(`hash "${hash}" is not registered with Bundler."`));
    }

    const absolutePaths = await this.getTargetAbsolutePaths();

    const absolutePath = resolveFilePath(absolutePaths[hash]);

    this._compileResults[hash] = await target.usingPlugin.build.plugin(absolutePath, this);
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
        const { usingPlugin } = this._targets[hash];

        if (await fse.exists(absolutePath)) {
          compileResults[hash] = await usingPlugin.build.plugin(absolutePath, this);
          this.logger.dispatchDebug(`✨ [${usingPlugin.build.name}] Build successful!`);
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
    Object.keys(this._targets).map((hash) => {
      const { entryPoint } = this._targets[hash];
      paths[hash] = resolve(projectDir, entryPoint);
    });

    return paths;
  }
}
