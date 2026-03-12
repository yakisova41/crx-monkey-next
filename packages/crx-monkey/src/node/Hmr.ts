import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import {
  SockServer,
  SockServerRequestSendResult,
  SockServerResponseSendResult,
} from './server/SockServer';
import { FilePath, I_HMR } from './typeDefs';
import { ConfigLoader } from './ConfigLoader';
import fse from 'fs-extra';
import { resolve } from 'path';
import MurmurHash3 from 'murmurhash3js';

@injectable()
export class HMR implements I_HMR {
  // Record<entryPoint, buildResult>
  private storedResults: Record<string, Uint8Array> = {};

  constructor(
    @inject(TYPES.SockServer) private sockServer: SockServer,
    @inject(TYPES.ConfigLoader) private configLoader: ConfigLoader,
  ) {}

  public setup() {
    this.sockServer.addMsgListener((msg, sendResponse) => {
      if (msg.type === 'request_result') {
        // A HMR client requests being sent the build result.
        const {
          content: { entryPoint },
        } = msg as SockServerRequestSendResult;

        if (this.storedResults[entryPoint] === undefined) {
          throw new Error(`The build result of "${entryPoint}" does not found`);
        }

        const decoder = new TextDecoder();
        const decodedResult = decoder.decode(this.storedResults[entryPoint]);
        const varinjection = [`var __crxm_running_env = 'userjs-html_script_react';`, ''].join(
          '\n',
        );
        const code = varinjection + decodedResult;

        // Response build result to userjs client
        const response: SockServerResponseSendResult = {
          type: 'request_result_response',
          content: {
            js: code,
          },
        };

        sendResponse(response);
      }
    });
  }

  public async dispatchResult(entry: FilePath<'absolute'>, buildResult: Uint8Array) {
    const {
      output: { chrome },
    } = this.configLoader.useConfig();

    if (chrome === undefined) {
      throw new Error('chrome');
    }

    const cacheFileName = this.getCacheFileName(entry);

    const decoder = new TextDecoder();
    const decodedResult = decoder.decode(buildResult);

    this.storedResults[entry] = buildResult;

    // for chrome
    await (async () => {
      const varinjection = [`var __crxm_running_env = 'chrome-html_script_react';`, ''].join('\n');
      const code = varinjection + decodedResult;
      await fse.outputFile(resolve(chrome, cacheFileName), code);
    })();

    // for chrome to reload and for userjs
    await (async () => {
      const varinjection = [`var __crxm_running_env = 'userjs-html_script_react';`, ''].join('\n');
      const code = varinjection + decodedResult;
      this.sockServer.reload<SockServerResponseSendResult>('HMR_' + entry, {
        content: {
          js: code,
        },
        type: 'request_result_response',
      });
    })();
  }

  public getCacheFileName(entry: FilePath<'absolute'>) {
    const endemicHash = MurmurHash3.x86.hash32(entry).toString();

    const cacheFileName = `hmr_cache_${endemicHash}.js`;

    return cacheFileName;
  }

  public get websocketAddress(): `ws://${string}:${string}` {
    return `ws://${this.sockServer.host}:${this.sockServer.port}`;
  }
}
