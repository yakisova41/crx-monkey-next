import esbuild, { BuildOptions, Plugin, PluginBuild } from 'esbuild';
import { CrxmBundlerPlugin, CrxmBundlerPluginWatch, CrxmResultSender } from '../typeDefs';
import typescript, {
  CompilerOptions,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
} from 'typescript';
import chalk from 'chalk';

export interface TsBundlerOptions {
  /**
   * The options esbuild.
   */
  esbuild?: BuildOptions;
  /**
   * Use checking types.
   */
  typeCheck?: boolean;
  /**
   * The path tsconfig.json
   */
  tsconfig?: string;
}

interface EsbuildTypecheckPluginArgs {
  compilerOptions?: CompilerOptions;
  exit: boolean;
}

function esbuildTypecheckPlugin(options: EsbuildTypecheckPluginArgs = { exit: false }) {
  const tsPlugin: Plugin = {
    name: 'esbuild-typecheck-plugin',
    setup: (build: PluginBuild) => {
      build.onLoad(
        {
          filter: new RegExp(/^.*.(ts|tsx)$/),
        },
        (args) => {
          const { path } = args;

          const compilerOptions =
            options.compilerOptions !== undefined
              ? options.compilerOptions
              : { strict: true, noEmit: true };

          const program = typescript.createProgram([path], compilerOptions);

          const diagnostics = typescript.getPreEmitDiagnostics(program);

          try {
            diagnostics.forEach((d) => {
              const message = typescript.flattenDiagnosticMessageText(d.messageText, '\n');
              if (d.file && d.start !== undefined) {
                const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);

                // Get source code
                const fileText = d.file.getFullText();
                const lines = fileText.split(/\r?\n/);
                const startLine = Math.max(0, line - 1);
                const endLine = Math.min(lines.length - 1, line + 1);

                console.error(
                  `\n ${chalk.bgBlueBright(' Typescript ')} ${chalk.bold(message)}\n` +
                    `   ${chalk.gray(`${d.file.fileName} (${line + 1},${character + 1})`)}`,
                );

                for (let i = startLine; i <= endLine; i++) {
                  const lineNumber = String(i + 1).padStart(4);
                  const prefix = i === line ? chalk.yellow('>') : ' ';
                  console.error(`${prefix} ${chalk.gray(lineNumber)}  ${lines[i]}`);

                  if (i === line) {
                    console.error(`    ${' '.repeat(6 + character)}${chalk.red('^')}`);
                  }
                }

                if (options.exit) {
                  process.exit(1);
                }
              } else {
                throw new Error(message);
              }
            });
          } catch (e) {
            process.exit(1);
          }
          return null;
        },
      );
    },
  };
  return tsPlugin;
}

/**
 * Bundle typescript by esbuild
 * @param options
 * @returns
 */
export function tsBundler(options: TsBundlerOptions = { esbuild: {} }): CrxmBundlerPlugin {
  const tsPluginOptions: EsbuildTypecheckPluginArgs = {
    compilerOptions: {},
    exit: true,
  };

  if (options.tsconfig !== undefined) {
    const tsconfig = readConfigFile(options.tsconfig, sys.readFile);
    const parsedOptions = parseJsonConfigFileContent(tsconfig.config, sys, './');

    if (tsconfig.config !== undefined) {
      tsPluginOptions.compilerOptions = parsedOptions.options;
    }
  }

  return {
    name: 'Crxm Typescript Plugin',
    plugin: async (filePath: string) => {
      return await esbuild
        .build({
          ...(options.esbuild !== undefined ? options.esbuild : {}),
          entryPoints: [filePath],
          treeShaking: true,
          bundle: true,
          metafile: true,
          write: false,
          format: 'iife',
          target: 'esnext',
          platform: 'browser',
          logLevel: 'error',
          external: ['esbuild', 'esbuild/*', 'fs-extra', 'fs-extra/*', 'fs', 'path', 'crypto'],
          tsconfig: options.tsconfig,

          plugins: [
            ...(options.esbuild?.plugins !== undefined ? options.esbuild.plugins : []),
            ...(options.typeCheck ? [esbuildTypecheckPlugin(tsPluginOptions)] : []),
          ],
        })
        .then((result) => {
          const outputFile = result.outputFiles[0];
          return outputFile.contents;
        });
    },
  };
}

/**
 * Bundle typescript by esbuild
 * @param options
 * @returns
 */
export function tsBundlerWatch(
  options: TsBundlerOptions = { esbuild: {} },
): CrxmBundlerPluginWatch {
  return {
    name: 'Crxm Watch Typescript Plugin',
    plugin: async (filePath: string, sendResult: CrxmResultSender) => {
      const watchPlugin: Plugin = {
        name: 'send-esbuild-build-result-to-crxm-plugin',
        setup: (build: PluginBuild) => {
          build.onEnd((result) => {
            if (result.outputFiles !== undefined) {
              const outputFile = result.outputFiles[0].contents;
              sendResult(outputFile);
            }
          });
        },
      };

      const tsPluginOptions: EsbuildTypecheckPluginArgs = {
        compilerOptions: {
          target: 99,
        },
        exit: false,
      };

      if (options.tsconfig !== undefined) {
        const tsconfig = readConfigFile(options.tsconfig, sys.readFile);
        const parsedOptions = parseJsonConfigFileContent(tsconfig.config, sys, './');

        if (tsconfig.config !== undefined) {
          tsPluginOptions.compilerOptions = parsedOptions.options;
        }
      }

      const ctx = await esbuild.context({
        ...(options.esbuild !== undefined ? options.esbuild : {}),
        entryPoints: [filePath],
        format: 'iife',
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
          ...(options.typeCheck ? [esbuildTypecheckPlugin(tsPluginOptions)] : []),
          watchPlugin,
        ],
      });

      await ctx.watch();

      return {
        stop: async () => {
          await ctx.dispose();
          // console.log(`${filePath} watching stoped`);
        },
      };
    },
  };
}
