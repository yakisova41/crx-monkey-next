import { Container } from 'inversify';

import { ConfigLoader } from './ConfigLoader';
import { ManifestLoader } from './manifest/ManifestLoader';
import { TYPES } from './types';
import { ManifestParser } from './manifest/ManifestParser';
import { CrxmBundler } from './CrxmBundler';
import { Watcher } from './Watcher';
import { BundlerRegisterer } from './BundlerRegisterer';
import { Distributior } from './Distributior';
import { ManifestFactory } from './manifest/ManifestFactory';
import { UserscriptBundler } from './userscript/UserscriptBundler';
import { UserscriptHeaderFactory } from './userscript/UserscriptHeader';
import { UserscriptRegisterer } from './userscript/UserscriptRegisterer';
import { Logger } from './Logger';
import { SockServer } from './server/SockServer';
import { CreateDevClient } from './development/CreateDevClient';
import { FileServer } from './server/FileServer';
import { Popup } from './popup/Popup';
import { HMR } from './Hmr';

/**
 * DI container
 */
export const container: Container = new Container();

/**
 * Classes
 */
container.bind<Logger>(TYPES.Logger).to(Logger).inSingletonScope();
container.bind<ConfigLoader>(TYPES.ConfigLoader).to(ConfigLoader).inSingletonScope();

container.bind<ManifestLoader>(TYPES.ManifestLoader).to(ManifestLoader).inSingletonScope();
container.bind<ManifestParser>(TYPES.ManifestParser).to(ManifestParser).inSingletonScope();
container.bind<CrxmBundler>(TYPES.CrxmBundler).to(CrxmBundler).inSingletonScope();
container.bind<Watcher>(TYPES.Watcher).to(Watcher).inSingletonScope();
container.bind<Popup>(TYPES.Popup).to(Popup).inSingletonScope();

container.bind<BundlerRegisterer>(TYPES.BundlerRegisterer).to(BundlerRegisterer).inSingletonScope();
container.bind<Distributior>(TYPES.Distributior).to(Distributior).inSingletonScope();
container.bind<ManifestFactory>(TYPES.ManifestFactory).to(ManifestFactory).inSingletonScope();
container.bind<UserscriptBundler>(TYPES.UserscriptBundler).to(UserscriptBundler).inSingletonScope();
container
  .bind<UserscriptHeaderFactory>(TYPES.UserscriptHeaderFactory)
  .to(UserscriptHeaderFactory)
  .inSingletonScope();
container
  .bind<UserscriptRegisterer>(TYPES.UserscriptRegisterer)
  .to(UserscriptRegisterer)
  .inSingletonScope();
container.bind<SockServer>(TYPES.SockServer).to(SockServer).inSingletonScope();
container.bind<CreateDevClient>(TYPES.CreateDevClient).to(CreateDevClient).inSingletonScope();
container.bind<FileServer>(TYPES.FileServer).to(FileServer).inSingletonScope();
container.bind<HMR>(TYPES.Hmr).to(HMR).inSingletonScope();
/**
 * Values
 */
container.bind<string>(TYPES.CacheDir).toConstantValue('.crxm');
