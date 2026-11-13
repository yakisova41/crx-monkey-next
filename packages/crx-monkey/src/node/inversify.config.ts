import { Container } from 'inversify';

import { ConfigLoader } from './ConfigLoader';
import { ManifestLoader } from './manifest/ManifestLoader';
import { TYPES } from './types';
import { ManifestParser } from './manifest/ManifestParser';
import { CrxmBundler } from './CrxmBundler';
import { Watcher } from './Watcher';
import { BundlerRegisterer } from './BundlerRegisterer';
import { ManifestFactory, type I_ManifestFactory } from './manifest/ManifestFactory';
import { UserscriptBundler, type I_UserscriptBundler } from './userscript/UserscriptBundler';
import { UserscriptHeaderFactory } from './userscript/UserscriptHeader';
import { UserscriptRegisterer } from './userscript/UserscriptRegisterer';
import { Logger, type I_Logger } from './Logger';
import { SockServer } from './server/SockServer';
import { CreateDevClient } from './development/CreateDevClient';
import { FileServer } from './server/FileServer';
import { Popup, type I_Popup } from './popup/Popup';
import { HMR } from './Hmr';
import { I_FileSystem, FileSystem } from './FileSystem';
import { I18n, I_I18n } from './manifest/I18n';
import { I_OutputBundledService, OutputBundledService } from './OutputBundled/OutputBundledService';
import {
  I_OutputChromeService,
  OutputChromeService,
} from './OutputBundled/OutputChrome/OutputChromeService';
import {
  OutputUserjsService,
  type I_OutputUserjsService,
} from './OutputBundled/OutputUserjs/OutputUserjsService';

/**
 * DI containe
 */
export const container: Container = new Container();

/**
 * Classes
 */
container.bind<I_Logger>(TYPES.Logger).to(Logger).inSingletonScope();
container.bind<I_FileSystem>(TYPES.FileSystem).to(FileSystem).inSingletonScope();
container.bind<I_I18n>(TYPES.I18n).to(I18n).inSingletonScope();

container.bind<ConfigLoader>(TYPES.ConfigLoader).to(ConfigLoader).inSingletonScope();
container.bind<ManifestLoader>(TYPES.ManifestLoader).to(ManifestLoader).inSingletonScope();
container.bind<ManifestParser>(TYPES.ManifestParser).to(ManifestParser).inSingletonScope();
container.bind<CrxmBundler>(TYPES.CrxmBundler).to(CrxmBundler).inSingletonScope();
container.bind<Watcher>(TYPES.Watcher).to(Watcher).inSingletonScope();
container.bind<I_Popup>(TYPES.Popup).to(Popup).inSingletonScope();

container.bind<BundlerRegisterer>(TYPES.BundlerRegisterer).to(BundlerRegisterer).inSingletonScope();

container
  .bind<I_OutputBundledService>(TYPES.OutputBundledService)
  .to(OutputBundledService)
  .inSingletonScope();

container
  .bind<I_OutputChromeService>(TYPES.OutputChromeService)
  .to(OutputChromeService)
  .inSingletonScope();

container
  .bind<I_OutputUserjsService>(TYPES.OutputUserjsService)
  .to(OutputUserjsService)
  .inSingletonScope();

container.bind<I_ManifestFactory>(TYPES.ManifestFactory).to(ManifestFactory).inSingletonScope();
container
  .bind<I_UserscriptBundler>(TYPES.UserscriptBundler)
  .to(UserscriptBundler)
  .inSingletonScope();
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
