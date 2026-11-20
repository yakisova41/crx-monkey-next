import { BundlerRegisterer } from './BundlerRegisterer';
import { ConfigLoader } from './ConfigLoader';
import { CrxmBundler } from './CrxmBundler';
import type { I_OutputBundledService } from './OutputBundled/OutputBundledService';
import { container } from './inversify.config';
import type { I_Logger } from './Logger';
import { I_I18n } from './manifest/I18n';
import { ManifestLoader } from './manifest/ManifestLoader';
import { TYPES } from './types';
import type { I_UserscriptBundler } from './userscript/UserscriptBundler';
import { UserscriptRegisterer } from './userscript/UserscriptRegisterer';
import { errorHandler } from './utils';

/**
 * Build extension.
 */
export async function build() {
  try {
    container.bind(TYPES.IsWatch).toConstantValue(false);
    container.bind<string>(TYPES.BuildID).toConstantValue(crypto.randomUUID());

    const logger = container.get<I_Logger>(TYPES.Logger);
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
    const output = container.get<I_OutputBundledService>(TYPES.OutputBundledService);
    const registerer = container.get<BundlerRegisterer>(TYPES.BundlerRegisterer);
    const userscriptRegisterer = container.get<UserscriptRegisterer>(TYPES.UserscriptRegisterer);

    const userscriptBundler = container.get<I_UserscriptBundler>(TYPES.UserscriptBundler);

    await output.cleanupDist();

    const i18n = container.get<I_I18n>(TYPES.I18n);

    await i18n.copyLocales();

    // Register all build targets for bundler from manifest.
    output.setDefines(await registerer.registerAll());

    userscriptBundler.initialize();
    await userscriptRegisterer.sync();

    // Bundle
    await bundler.build();
    // Output bundled file to dist
    await output.outputAll();

    logger.dispatchLog(`Build successful!`);
  } catch (e) {
    const err = e as Error;
    errorHandler(err);
  }
}
