/**
 * For inversify
 */
export const TYPES = {
  ConfigLoader: Symbol.for('I_ConfigLoader'),
  ManifestLoader: Symbol.for('I_ManifestLoader'),
  ManifestParser: Symbol.for('I_ManifestParser'),
  CrxmBundler: Symbol.for('I_CrxmBundler'),
  Watcher: Symbol.for('I_Watcher'),
  BundlerRegisterer: Symbol.for('I_BundlerRegisterer'),
  Distributior: Symbol.for('I_Distributior'),
  ManifestFactory: Symbol.for('I_ManifestFactory'),
  UserscriptBundler: Symbol.for('I_UserscriptBundler'),
  UserscriptHeaderFactory: Symbol.for('I_UserscriptHeaderFactory'),
  UserscriptRegisterer: Symbol.for('I_UserscriptRegisterer'),
  Logger: Symbol.for('I_Logger'),
  SockServer: Symbol.for('I_SockServer'),
  CreateDevClient: Symbol.for('I_CreateDevClient'),
  FileServer: Symbol.for('I_FileServer'),
  Popup: Symbol.for('I_Popup'),
  BuildID: Symbol.for('BuildID'),
  CacheDir: Symbol.for('CacheDir'),
  IsWatch: Symbol.for('IsWatch'),
  Hmr: Symbol.for('Hmr'),
};
