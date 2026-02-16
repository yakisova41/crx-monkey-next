import { CrxmBundlerPluginWatch } from '../../typeDefs';
import esbuild, { Plugin, PluginBuild } from 'esbuild';
import { TsBundlerOptions } from '../tsBundler';
import { developmentReact } from './development';

export function reactWatch(options: TsBundlerOptions = { esbuild: {} }): CrxmBundlerPluginWatch {
  return {
    name: 'React watch plugin',
    plugin: async (filePath, sendResult, bundler) => {
      bundler.hmr.enable();

      /**
       * Watch and send
       */
      const watchPlugin: Plugin = {
        name: 'esbuild build result dispatch plugin',
        setup: (build: PluginBuild) => {
          build.onEnd((result) => {
            if (result.outputFiles !== undefined) {
              const outputFile = result.outputFiles[0].contents;
              bundler.hmr.dispatchResult(filePath, outputFile);
            }
          });
        },
      };

      const ctx = await esbuild.context({
        ...(options.esbuild !== undefined ? options.esbuild : {}),
        entryPoints: [filePath],
        format: 'esm',
        treeShaking: true,
        bundle: true,
        metafile: true,
        write: false,
        target: 'esnext',
        platform: 'browser',
        logLevel: 'error',
        tsconfig: options.tsconfig,
        external: ['esbuild', 'esbuild/*', 'fs-extra', 'fs-extra/*', 'fs', 'path', 'crypto'],
        plugins: [
          ...(options.esbuild?.plugins !== undefined ? options.esbuild.plugins : []),
          watchPlugin,
        ],
      });

      await ctx.watch();

      /**
       * script for dev
       */
      const code = stringifyFunction(developmentReact, [
        bundler.hmr.websocketAddress,
        filePath,
        bundler.hmr.getCacheFileName(filePath),
      ]);
      const encoder = new TextEncoder();
      const binary = encoder.encode(code);
      sendResult(binary);

      return {
        stop: async () => {},
      };
    },
  };
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
