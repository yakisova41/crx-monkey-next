import { inject, injectable } from 'inversify';
import { TYPES } from './types';
import { SockServer } from './server/SockServer';
import { FileServer } from './server/FileServer';
import { I_HMR } from './typeDefs';
import { ManifestFactory } from './manifest/ManifestFactory';
import { ConfigLoader } from './ConfigLoader';
import fse from 'fs-extra';
import { resolve } from 'path';
import MurmurHash3 from 'murmurhash3js';

@injectable()
export class HMR implements I_HMR {
  constructor(
    @inject(TYPES.SockServer) private sockServer: SockServer,
    @inject(TYPES.FileServer) private fileServer: FileServer,
    @inject(TYPES.ManifestFactory) private manifestFactory: ManifestFactory,
    @inject(TYPES.ConfigLoader) private configLoader: ConfigLoader,
  ) {}

  public enable() {
    this.manifestFactory.setCsp("script-src 'self'; script-src-elem 'self'");
  }

  public async dispatchResult(entry: string, buildResult: Uint8Array) {
    const {
      output: { chrome },
    } = this.configLoader.useConfig();

    if (chrome === undefined) {
      throw new Error('chrome');
    }

    const cacheFileName = this.getCacheFileName(entry);

    await fse.outputFile(resolve(chrome, cacheFileName), buildResult);

    this.sockServer.reload('HMR_' + entry, {
      js: cacheFileName,
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
