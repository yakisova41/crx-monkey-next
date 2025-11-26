import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';
import { developSw } from './codes/sw';
import { CrxmBundler } from '../CrxmBundler';
import { UserscriptHeaderFactory } from '../userscript/UserscriptHeader';
import { userjs } from './codes/userjs';
import { resolve } from 'path';
import { developmentContentScript, isolatedConnector } from './codes/extension';
import fsExtra, { outputFileSync } from 'fs-extra/esm';
import { ManifestFactory } from '../manifest/ManifestFactory';

@injectable()
export class CreateDevClient {
  constructor(
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.CrxmBundler) private readonly bundler: CrxmBundler,
    @inject(TYPES.UserscriptHeaderFactory) private readonly headerFactory: UserscriptHeaderFactory,
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.BuildID) private readonly buildId: string,
  ) {}

  /**
   * Make code for service worker on developement.
   */
  public outputDevelomentSw(code: Uint8Array) {
    const {
      server: { host, websocket },
    } = this.configLoader.useConfig();

    if (host === undefined || websocket === undefined) {
      throw new Error("Server host or websocket's port were not specificated");
    }

    const decoder = new TextDecoder('utf-8');
    const originalCode = decoder.decode(code);

    const devCode = stringifyFunction(developSw, [host, websocket]);

    const result = devCode + '\n\n' + originalCode;

    return result;
  }

  public outputDevelopmentUserjs() {
    const {
      server: { disable_sock_in_userjs, host, port, websocket },
    } = this.configLoader.useConfig();

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
      stringifyFunction(userjs, [host, port, websocket, false, disableSock, this.buildId]),
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

  /**
   * Include isolated connector
   */
  public outputIsolatedConnector() {
    const {
      output: { chrome },
      server: { host, websocket },
    } = this.configLoader.useConfig();

    if (chrome === undefined || host === undefined || websocket === undefined) {
      throw new Error('');
    }

    let includeConnector = false;
    const isolatedmatches: string[] = [];

    this.manifestFactory.rawManifest.content_scripts.forEach(
      ({ use_isolated_connection, matches }) => {
        if (use_isolated_connection) {
          isolatedmatches.push(...(matches !== undefined ? matches : []));
          includeConnector = true;
        }
      },
    );

    if (includeConnector) {
      const isoFileName = 'crxm-isolated-connector.js';
      const isoConnectorPath = resolve(chrome, isoFileName);
      outputFileSync(
        isoConnectorPath,
        `${stringifyFunction(isolatedConnector, [this.buildId, JSON.stringify(this.configLoader.useConfig())])}\n`,
      );
      this.manifestFactory.addContentScript(
        [isoFileName],
        [],
        [...isolatedmatches],
        'ISOLATED',
        'document_start',
      );
    }
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
