import { watch } from 'fs';
import { CrxmBundlerPlugin, CrxmBundlerPluginWatch, CrxmResultSender } from '../../client/typeDefs';
import { compile, Options } from 'sass';

export interface SassBundlerOptions {
  sass: Options<'sync'>;
}

/**
 * Bundle sass
 * @param options
 * @returns
 */
export function sassBundler(options: SassBundlerOptions = { sass: {} }): CrxmBundlerPlugin {
  return async (filePath: string) => {
    const result = compile(filePath, options.sass);
    const encoder = new TextEncoder();
    const encoded = encoder.encode(result.css);
    return encoded;
  };
}

/**
 * Watch sass
 * @param options
 * @returns
 */
export function sassBundlerWatch(
  options: SassBundlerOptions = { sass: {} },
): CrxmBundlerPluginWatch {
  return async (filePath: string, sendResult: CrxmResultSender) => {
    const watcher = watch(filePath);

    const compileAndSend = () => {
      const result = compile(filePath, options.sass);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(result.css);
      sendResult(encoded);
    };

    compileAndSend();

    watcher.addListener('change', () => {
      compileAndSend();
    });

    return {
      stop: async () => {
        watcher.close();
      },
    };
  };
}
