import { CrxmBundlerPlugin, CrxmBundlerPluginWatch } from '../../../client/typeDefs';
import { basename, resolve } from 'path';
import { HTMLTools } from './HTMLTools';
import MurmurHash3 from 'murmurhash3js';
import fse from 'fs-extra';

export interface HtmlBundlerOptions {
  output: string;
  plugins: {
    build: Record<string, CrxmBundlerPlugin>;
    watch: Record<string, CrxmBundlerPluginWatch>;
  };
}

let htmlTools: HTMLTools | null = null;
let listenerAdded = false;

export function htmlBundlerWatch(options: HtmlBundlerOptions): CrxmBundlerPluginWatch {
  return async (filePath, sendResult, bundler) => {
    const distPath = resolve(options.output);

    if (htmlTools === null) {
      htmlTools = new HTMLTools(filePath, options.output, options.plugins, bundler);
      await htmlTools.watchHTML();
    }

    if (!listenerAdded) {
      bundler.addListener((target) => {
        if (htmlTools !== null) {
          if (target.flag === 'html_script' || target.flag === 'html_href') {
            const result = bundler.compileResults[target.hash];

            if (target.flag === 'html_script') {
              const extChanged = changeExt(target.entryPoint, 'js');
              const endemicHash = MurmurHash3.x86.hash32(target.entryPoint).toString();

              const fileName = endemicHash + '_' + extChanged;

              const outputPath = resolve(distPath, fileName);

              fse.outputFileSync(outputPath, result);

              htmlTools.resolveScript(target.entryPoint, fileName);
            }

            if (target.flag === 'html_href') {
              const extChanged = changeExt(target.entryPoint, 'css');
              const endemicHash = MurmurHash3.x86.hash32(target.entryPoint).toString();

              const fileName = endemicHash + '_' + extChanged;

              const outputPath = resolve(distPath, fileName);

              fse.outputFileSync(outputPath, result);

              htmlTools.resolveHref(target.entryPoint, fileName);
            }

            const html = htmlTools.outputHtmlResolved();
            const encoder = new TextEncoder();
            const encoded = encoder.encode(html);

            sendResult(encoded);
          }
        }
      });
      listenerAdded = true;
    }

    return {
      stop: async () => {
        if (htmlTools !== null) {
          htmlTools.stopWatch();
          htmlTools = null;
        }
      },
    };
  };
}

export function htmlBundler(options: HtmlBundlerOptions): CrxmBundlerPlugin {
  return async (filePath, bundler) => {
    const distPath = resolve(options.output);

    const htmlTools = new HTMLTools(filePath, options.output, options.plugins, bundler);

    const hashs = await htmlTools.build();

    await Promise.all(
      hashs.map(async (hash) => {
        const target = await bundler.compileForce(hash);
        const result = bundler.compileResults[target.hash];

        if (target.flag === 'html_script') {
          const extChanged = changeExt(target.entryPoint, 'js');
          const endemicHash = MurmurHash3.x86.hash32(target.entryPoint).toString();

          const fileName = endemicHash + '_' + extChanged;

          const outputPath = resolve(distPath, fileName);

          fse.outputFileSync(outputPath, result);

          htmlTools.resolveScript(target.entryPoint, fileName);
        }

        if (target.flag === 'html_href') {
          const extChanged = changeExt(target.entryPoint, 'css');
          const endemicHash = MurmurHash3.x86.hash32(target.entryPoint).toString();

          const fileName = endemicHash + '_' + extChanged;

          const outputPath = resolve(distPath, fileName);
          fse.outputFileSync(outputPath, result);

          htmlTools.resolveHref(target.entryPoint, fileName);
        }
      }),
    );

    const html = htmlTools.outputHtmlResolved();
    const encoder = new TextEncoder();
    const encoded = encoder.encode(html);

    return encoded;
  };
}

function changeExt(filePath: string, newExt: string) {
  const rawFileNameSplited = basename(filePath).split('.');
  rawFileNameSplited[rawFileNameSplited.length - 1] = newExt;
  const newFilename = rawFileNameSplited.join('.');
  return newFilename;
}
