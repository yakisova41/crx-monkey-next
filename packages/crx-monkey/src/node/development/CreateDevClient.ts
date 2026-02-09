import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';
import { developSw } from './codes/sw';
import { CrxmBundler } from '../CrxmBundler';
import { UserscriptHeaderFactory } from '../userscript/UserscriptHeader';
import { userjs } from './codes/userjs';
import { resolve } from 'path';
import { developmentContentScript } from './codes/extension';
import fsExtra from 'fs-extra/esm';
import { ManifestFactory } from '../manifest/ManifestFactory';
import type { I_ManifestParser } from '../manifest/ManifestParser';

@injectable()
export class CreateDevClient {
  constructor(
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.CrxmBundler) private readonly bundler: CrxmBundler,
    @inject(TYPES.UserscriptHeaderFactory) private readonly headerFactory: UserscriptHeaderFactory,
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.BuildID) private readonly buildId: string,
    @inject(TYPES.ManifestParser) private readonly manifestParser: I_ManifestParser,
  ) {}

  /**
   * Make code for service worker on developement.
   */
  public outputDevelomentSw(code: string) {
    const {
      server: { host, websocket },
    } = this.configLoader.useConfig();

    if (host === undefined || websocket === undefined) {
      throw new Error("Server host or websocket's port were not specificated");
    }

    const devCode = stringifyFunction(developSw, [host, websocket]);

    const result = devCode + '\n\n' + code;

    return result;
  }

  public outputDevelopmentUserjs() {
    const {
      server: { disable_sock_in_userjs, host, port, websocket },
      popup_in_userscript,
    } = this.configLoader.useConfig();
    const { isUsingTrustedScripts } = this.manifestParser.parseResult;

    if (host === undefined || websocket === undefined || port === undefined) {
      throw new Error("Server host, port or  websocket's port were not specificated");
    }

    const disableSock = disable_sock_in_userjs === undefined ? false : disable_sock_in_userjs;

    const newFactory = new UserscriptHeaderFactory(this.headerFactory);

    // for loading code from server in development mode.
    newFactory.push('@grant', 'GM_xmlhttpRequest');

    const code = [
      newFactory.toString(),
      '',
      stringifyFunction(userjs, [
        host,
        port,
        websocket,
        false,
        disableSock,
        this.buildId,
        popup_in_userscript,
        isUsingTrustedScripts,
      ]),
    ].join('\n');

    return code;
  }

  public outputDevExtension() {
    const {
      output: { chrome },
      server: { host, websocket },
    } = this.configLoader.useConfig();

    if (chrome === undefined || host === undefined || websocket === undefined) {
      throw new Error('');
    }

    /**
     * Development contentscript in isolated env
     */
    const devScriptIsolatedFileName = 'crxm-development.js';
    const devScriptIsolatedPath = resolve(chrome, devScriptIsolatedFileName);

    const devScriptIsolatedCode = stringifyFunction(developmentContentScript, [
      this.buildId,
      host,
      websocket,
    ]);

    fsExtra.outputFileSync(devScriptIsolatedPath, devScriptIsolatedCode);

    this.manifestFactory.addContentScript(
      [devScriptIsolatedFileName],
      [],
      ['<all_urls>'],
      'ISOLATED',
    );
  }
}

/**
 * Stringify a function that binded args.
 * @param target function
 * @param args args
 * @returns A function stringified.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stringifyFunction<V extends (...args: any[]) => any>(
  target: V,
  args: Parameters<V>,
): string {
  const raw = target.toString();

  const newArgs = args.map((arg) => {
    if (typeof arg === 'string') {
      return `'${arg}'`;
    } else {
      return String(arg);
    }
  });

  const code = `(${raw})(${newArgs.join(', ')});`;
  return code;
}
