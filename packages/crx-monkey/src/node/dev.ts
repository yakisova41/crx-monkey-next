import { CrxmBundler } from './CrxmBundler';
import { BundlerRegisterer } from './BundlerRegisterer';
import { ConfigLoader } from './ConfigLoader';
import { container } from './inversify.config';
import { ManifestLoader } from './manifest/ManifestLoader';
import { TYPES } from './types';
import { Watcher } from './Watcher';
import { Distributior } from './Distributior';
import { ManifestFactory } from './manifest/ManifestFactory';
import { UserscriptRegisterer } from './userscript/UserscriptRegisterer';
import { UserscriptHeaderFactory } from './userscript/UserscriptHeader';
import { UserscriptBundler } from './userscript/UserscriptBundler';
import { Logger } from './Logger';
import { SockServer, SockServerConsoleRecieved } from './server/SockServer';
import { CreateDevClient } from './development/CreateDevClient';
import { FileServer } from './server/FileServer';
import { copyLocales } from './manifest/i18n';
import chalk from 'chalk';

/**
 * Start develop mode.
 */
export async function dev() {
  container.bind(TYPES.IsWatch).toConstantValue(true);

  container.bind<string>(TYPES.BuildID).toConstantValue(crypto.randomUUID());

  const logger = container.get<Logger>(TYPES.Logger);
  //logger.initialize();

  const configLoader = container.get<ConfigLoader>(TYPES.ConfigLoader);

  // Load the config from project.
  await configLoader.loadConfig();

  const { logLevel } = configLoader.useConfig();
  logger.logLevel = logLevel;
  logger.showInfo();

  const manifestLoader = container.get<ManifestLoader>(TYPES.ManifestLoader);
  // Load the manifest from project.
  await manifestLoader.loadManifest();

  const manifestFactory = container.get<ManifestFactory>(TYPES.ManifestFactory);
  const watcher = container.get<Watcher>(TYPES.Watcher);
  const bundler = container.get<CrxmBundler>(TYPES.CrxmBundler);
  const distributior = container.get<Distributior>(TYPES.Distributior);
  const registerer = container.get<BundlerRegisterer>(TYPES.BundlerRegisterer);
  const userscriptRegisterer = container.get<UserscriptRegisterer>(TYPES.UserscriptRegisterer);
  const userscriptHeaderFactory = container.get<UserscriptHeaderFactory>(
    TYPES.UserscriptHeaderFactory,
  );
  const userscriptBundler = container.get<UserscriptBundler>(TYPES.UserscriptBundler);
  const sockServer = container.get<SockServer>(TYPES.SockServer);
  const createDevClient = container.get<CreateDevClient>(TYPES.CreateDevClient);
  const fileServer = container.get<FileServer>(TYPES.FileServer);

  await distributior.cleanupDist();

  copyLocales();

  // The websocket server for hotreload.
  sockServer.setup();
  fileServer.start();

  // Register all build targets for bundler from manifest.
  registerer.registerAll();

  userscriptBundler.initialize();
  await userscriptRegisterer.sync();

  createDevClient.outputDevExtension();

  // Bundle
  await bundler.watch();
  // Output bundled file to dist
  distributior.dist();

  // On updated manifest or config
  watcher.addListener(async () => {
    const { logLevel } = configLoader.useConfig();
    logger.logLevel = logLevel;
    logger.showInfo();

    // Reload manifest from loader
    manifestFactory.initialize();
    // Register all build targets for bundler from manifest.
    registerer.registerAll();

    userscriptBundler.initialize();
    userscriptHeaderFactory.initialize();
    await userscriptRegisterer.sync();

    createDevClient.outputDevExtension();

    // Bundle
    await bundler.stopWatch();
    await bundler.watch();
    // Output bundled file to dist
    distributior.dist();

    await fileServer.dispose();
    await fileServer.start();

    sockServer.reload('ALL');
  });

  // On updated script
  bundler.addListener((target) => {
    distributior.dist();

    if (target.flag === 'content') {
      sockServer.reload('RELOAD_CONTENT_SCRIPT');
    } else if (target.flag === 'sw') {
      sockServer.reload('RELOAD_SW');
    } else if (target.flag === 'css') {
      sockServer.reload('RELOAD_CSS');
    } else if (target.flag === 'html_script') {
      sockServer.reload('RELOAD_POPUP_JS');
    } else if (target.flag === 'html' || target.flag === 'html_css') {
      sockServer.reload('RELOAD_POPUP_HTML');
    } else {
      sockServer.reload('ALL');
    }
  });

  sockServer.addMsgListener<SockServerConsoleRecieved>((msg) => {
    if (msg.type === 'console') {
      switch (msg.content.type) {
        case 'log':
          logger.dispatchConsole(msg.content.contents);
          break;
        case 'error':
          logger.dispatchConsole(`${chalk.bgRed(' ERROR ')} ${msg.content.contents}`);
          break;
        case 'warn':
          logger.dispatchConsole(`${chalk.bgYellow(' WARN ')} ${msg.content.contents}`);
          break;
      }
    }
  });

  watcher.start();
}
