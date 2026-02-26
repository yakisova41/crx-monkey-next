import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import {
  SockServer,
  SockServerRequestSendResult,
  SockServerResponseSendResult,
} from './server/SockServer';
import { I_HMR } from './typeDefs';
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
        const text = decoder.decode(this.storedResults[entryPoint]);

        // Response build result to client
        const response: SockServerResponseSendResult = {
          type: 'request_result_response',
          content: {
            js: text,
          },
        };

        sendResponse(response);
      }
    });
  }

  public async dispatchResult(entry: string, buildResult: Uint8Array) {
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

    await fse.outputFile(resolve(chrome, cacheFileName), decodedResult);

    this.sockServer.reload('HMR_' + entry, {
      js: decodedResult,
      fileName: cacheFileName,
    });
  }

  public getCacheFileName(entry: string) {
    const endemicHash = MurmurHash3.x86.hash32(entry).toString();

    const cacheFileName = `hmr_cache_${endemicHash}.js`;

    return cacheFileName;
  }

  public get websocketAddress(): `ws://${string}:${string}` {
    return `ws://${this.sockServer.host}:${this.sockServer.port}`;
  }
}
