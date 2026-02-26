import fse from 'fs-extra';
import { Plugin, PluginBuild } from 'esbuild';

/**
 * CSS
 */
export function esbuildCSSPlugin(): Plugin {
  return {
    name: 'esbuild css plugin by crxm',
    setup: (build: PluginBuild) => {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const css = await fse.readFile(args.path, { encoding: 'utf-8' });

        return {
          contents: `const s = document.createElement('style');\ns.appendChild(document.createTextNode(${JSON.stringify(css)}));\ndocument.head.appendChild(s);\n`,
        };
      });
    },
  };
}
