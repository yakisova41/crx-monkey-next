/**
 * The config for crx monkey.
 */
export interface CrxmConfig {
  output?: {
    /**
     * Directory of outputs.
     */
    chrome?: string;
    /**
     * The path containing the filename of the output userscript.
     */
    userjs?: string;
  };
  /**
   * The path of manifest.
   */
  manifest?: string;
  /**
   * Server settings.
   */
  server?: {
    /**
     * The port of file server.
     */
    port?: number;
    /**
     * The hostname using by file server and sockserver.
     */
    host?: string;
    /**
     * The port of websocket
     */
    websocket?: number;
    /**
     * Disable websocket for reloading in userscript
     */
    disable_sock_in_userjs?: boolean;
  };
  /**
   * Additional Userscript header
   */
  header?: UserScriptHeader;
  /**
   * Setting build plugin for any file
   * `Record<File regular expression, Bundler plugin>`
   */
  build?: Record<string, CrxmBundlerPlugin>;
  /**
   * Setting watch plugin for any file
   * `Record<File regular expression, Bundler plugin>`
   */
  watch?: Record<string, CrxmBundlerPluginWatch>;
  /**
   * The log level.
   * * `info` Show only infomations.
   * * `error` Show infomations and errors.
   * * `debug` Show all logs dispatched.
   */
  logLevel?: 'info' | 'error' | 'debug';
  /**
   * A directory copied as it is to `/public` in dist.
   */
  public: string | undefined;
}

type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type CrxmConfigRequired = DeepRequired<CrxmConfig>;

export type UserScriptHeader = Array<[keyof UserScriptHeaderProps, string]>;

export interface UserScriptHeaderProps {
  '@name': string;
  '@namespace'?: string;
  '@copyright'?: string;
  '@version': string;
  '@description'?: string;
  '@icon'?: string;
  '@iconURL'?: string;
  '@defaulticon'?: string;
  '@icon64'?: string;
  '@icon64URL'?: string;
  '@grant'?: string;
  '@author'?: string;
  '@homepage'?: string;
  '@homepageURL'?: string;
  '@website'?: string;
  '@source'?: string;
  '@antifeature'?: string;
  '@require'?: string;
  '@resource'?: string;
  '@include'?: string;
  '@match'?: string;
  '@exclude'?: string;
  '@run-at'?: string;
  '@sandbox'?: string;
  '@connect'?: string;
  '@noframes'?: string;
  '@updateURL'?: string;
  '@downloadURL'?: string;
  '@supportURL'?: string;
  '@webRequest'?: string;
  '@unwrap'?: string;
  [key: string]: string | undefined;
}

export interface CrxmManifest extends chrome.runtime.ManifestV3 {
  content_scripts?: CrxmContentScripts;
}

export interface CrxmManifestImportantKeys {
  description: string;
  content_scripts: CrxmContentScripts;
  background: { service_worker: string; type: string } | undefined;
  name: string;
  version: string;
  manifest_version: 3;
  action:
    | {
        default_icon:
          | {
              '16'?: string;
              '24'?: string;
              '32'?: string;
            }
          | undefined;
        default_title?: string;
        default_popup?: string;
      }
    | undefined;
  icons: Record<number, string> | undefined;
}

export type CrxmContentScript = {
  matches?: string[] | undefined;
  exclude_matches?: string[] | undefined;
  css?: string[] | undefined;
  js?: string[] | undefined;
  run_at?: 'document_start' | 'document_end' | 'document_idle' | undefined;
  all_frames?: boolean | undefined;
  match_about_blank?: boolean | undefined;
  include_globs?: string[] | undefined;
  exclude_globs?: string[] | undefined;
  world?: 'ISOLATED' | 'MAIN' | undefined;

  userscript_direct_inject?: boolean;
  trusted_inject?: boolean;
  use_isolated_connection?: boolean;
  [key: string]: unknown;
};
export type CrxmContentScripts = Array<CrxmContentScript>;

export type CrxmManifestImportantKeyRequired = DeepRequired<CrxmManifestImportantKeys>;

export type CrxmManifestRequired = CrxmManifestImportantKeyRequired & chrome.runtime.ManifestV3;

export type BuildTarget = {
  hash: string;
  entryPoint: string;
  usingPlugin: {
    build: CrxmBundlerPlugin;
    watch: CrxmBundlerPluginWatch[];
  };
  flag: string;
};

export type ScriptUpdateHandler = (target: BuildTarget) => unknown;

export interface I_CrxmBundler {
  compileResults: Record<string, Uint8Array>;
  addTarget(
    entryPoint: string,
    usingPlugin: { build: CrxmBundlerPlugin; watch: CrxmBundlerPluginWatch[] },
    flag: string,
  ): string;
  removeTarget(targetEntryPoint: string): void;
  getInternalHashFromPath(filePath: string, flag: string | null): string;
  getBuildResultFromPath(filePath: string): Uint8Array | undefined;
  build(): Promise<void>;
  compileForce(hash: string): Promise<BuildTarget>;
  watch(): Promise<void>;
  stopWatch(): Promise<void>;
  addListener(handler: ScriptUpdateHandler): void;
  removeListener(handler: ScriptUpdateHandler): void;
}

/**
 * Plugin for used when build.
 */
export type CrxmBundlerPlugin = (filepath: string, bundler: I_CrxmBundler) => Promise<Uint8Array>;
/**
 * Plugin for used when watch.
 */
export type CrxmBundlerPluginWatch = (
  filepath: string,
  sendResult: CrxmResultSender,
  bundler: I_CrxmBundler,
) => Promise<CrxmBundlerPluginWatcher>;

export type CrxmBundlerPluginWatcher = {
  stop: () => Promise<void>;
};

export type CrxmResultSender = (result: Uint8Array) => void;
