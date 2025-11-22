import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import { ConfigLoader } from './ConfigLoader';
import { ManifestLoader } from './manifest/ManifestLoader';
import { FSWatcher, watch } from 'fs';
import { dirname, resolve } from 'path';
import chalk from 'chalk';
import { Logger } from './Logger';

export interface I_Watcher {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(handler: UpdateHandler): void;
  removeListener(handler: UpdateHandler): void;
}

/**
 * Watch config and manifest
 */
@injectable()
export class Watcher implements I_Watcher {
  private readonly configPath: string;
  private configWatcher: FSWatcher | null = null;
  private manifestWatcher: FSWatcher | null = null;
  private updateHandlers: UpdateHandler[] = [];

  constructor(
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.ManifestLoader) private readonly manifestLoader: ManifestLoader,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {
    this.configPath = this.configLoader.useConfigPath();
  }

  /**
   * Start watching config and manifest
   */
  public async start() {
    // Start config watching
    if (this.configWatcher !== null) {
      throw new Error('The config watching is running now, stop it before using start.');
    }
    this.configWatcher = watch(this.configPath);

    const stack: (() => Promise<void>)[] = [];

    this.configWatcher.addListener('change', async () => {
      stack.push(async () => {
        this.logger.dispatchLog(`🚩 Config updated ${chalk.gray('"' + this.configPath + '"')}`);
        await this.onUpdateConfig();
      });
    });

    setInterval(async () => {
      if (stack[0] !== undefined) {
        await stack[0]();
        stack.splice(0, 1);
      }
    }, 1000);

    this.startManifestWatch(this.getManifestPath());
  }

  /**
   * Stop watching
   */
  public async stop() {
    this.stopManifestWatch();

    if (this.configWatcher !== null) {
      this.configWatcher.close();
      this.configWatcher = null;
    }
  }

  public addListener(handler: UpdateHandler) {
    this.updateHandlers.push(handler);
  }

  public removeListener(handler: UpdateHandler) {
    const newHandlers = this.updateHandlers.filter((h) => h !== handler);

    this.updateHandlers = newHandlers;
  }

  /**
   * Watching manifest file in project
   * @param manifestPath
   */
  private startManifestWatch(manifestPath: string) {
    if (this.manifestWatcher !== null) {
      throw new Error('The manifest watching is running now, stop it before using start.');
    }
    this.manifestWatcher = watch(manifestPath, {});

    const stack: (() => Promise<void>)[] = [];

    this.manifestWatcher.addListener('change', async () => {
      stack.push(async () => {
        this.logger.dispatchLog(`🚩 Manifest updated ${chalk.gray('"' + manifestPath + '"')}`);
        await this.onUpdateManifest();
      });
    });

    setInterval(async () => {
      if (stack[0] !== undefined) {
        await stack[0]();
        stack.splice(0, 1);
      }
    }, 1000);
  }

  /**
   * Stop watching manifest file in project
   * @param manifestPath
   */
  private stopManifestWatch() {
    if (this.manifestWatcher !== null) {
      this.manifestWatcher.close();
      this.manifestWatcher = null;
    }
  }

  /**
   * Run on updated config file.
   */
  private async onUpdateConfig() {
    await this.configLoader.loadConfig();

    const manifestPath = this.getManifestPath();

    await this.manifestLoader.loadManifest();
    this.stopManifestWatch();
    await Promise.all(
      this.updateHandlers.map(async (h) => {
        await h('config');
      }),
    );
    this.startManifestWatch(manifestPath);
  }

  /**
   * Run on updated manifest file.
   */
  private async onUpdateManifest() {
    await this.manifestLoader.loadManifest();
    await Promise.all(
      this.updateHandlers.map(async (h) => {
        await h('manifest');
      }),
    );
  }

  /**
   * Get manifest's filepath from config.
   * @returns
   */
  private getManifestPath() {
    const confPath = this.configLoader.useConfigPath();
    const projectDir = dirname(confPath);
    const manifestPath = resolve(projectDir, this.configLoader.useConfig().manifest);
    return manifestPath;
  }
}

export type UpdateHandler = (type: 'manifest' | 'config') => Promise<void> | void;
