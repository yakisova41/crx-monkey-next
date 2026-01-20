import { BundlerRegisterer } from './BundlerRegisterer';
import { ConfigLoader } from './ConfigLoader';
import { CrxmBundler } from './CrxmBundler';
import { Distributior } from './Distributior';
import { container } from './inversify.config';
import { Logger } from './Logger';
import { copyLocales } from './manifest/i18n';
import { ManifestLoader } from './manifest/ManifestLoader';
import { TYPES } from './types';
import { UserscriptBundler } from './userscript/UserscriptBundler';
import { UserscriptRegisterer } from './userscript/UserscriptRegisterer';
import { errorHandler } from './utils';

/**
 * Build extension.
 */
export async function build() {
  try {
    container.bind(TYPES.IsWatch).toConstantValue(false);
    container.bind<string>(TYPES.BuildID).toConstantValue(crypto.randomUUID());

    const logger = container.get<Logger>(TYPES.Logger);
    logger.initialize();

    const configLoader = container.get<ConfigLoader>(TYPES.ConfigLoader);
    // Load the config from project.
    await configLoader.loadConfig();

    const { logLevel } = configLoader.useConfig();
    logger.logLevel = logLevel;
    logger.dispatchLog('Building...');

    const manifestLoader = container.get<ManifestLoader>(TYPES.ManifestLoader);
    // Load the manifest from project.
    await manifestLoader.loadManifest();

    const bundler = container.get<CrxmBundler>(TYPES.CrxmBundler);
    const distributior = container.get<Distributior>(TYPES.Distributior);
    const registerer = container.get<BundlerRegisterer>(TYPES.BundlerRegisterer);
    const userscriptRegisterer = container.get<UserscriptRegisterer>(TYPES.UserscriptRegisterer);

    const userscriptBundler = container.get<UserscriptBundler>(TYPES.UserscriptBundler);

    await distributior.cleanupDist();

    copyLocales();

    // Register all build targets for bundler from manifest.
    await registerer.registerAll();

    userscriptBundler.initialize();
    await userscriptRegisterer.sync();

    // Bundle
    await bundler.build();
    // Output bundled file to dist
    await distributior.distAll();

    logger.dispatchLog(`Build successful!`);
  } catch (e) {
    const err = e as Error;
    errorHandler(err);
  }
}
