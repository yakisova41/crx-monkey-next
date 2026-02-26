import { CrxmBundlerPlugin, CrxmBundlerPluginWatch } from '../typeDefs';
import { watch, readFile } from 'fs';

/**
 * What is this?
 * Currently, this HTML bundler plugin functions merely as a file loader.
 * Previously, it parsed the popup HTML and passed the scripts to tsBundler for transpilation.
 * However, due to design changes to support UserJS popups, the plugin no longer handles transpilation.
 * Instead, the HTML is now processed internally via popup/Popup.ts.
 */

export function htmlBundler(): CrxmBundlerPlugin {
  return {
    name: 'HTML File loader',
    plugin: async (filePath) => {
      return new Promise((resolve, reject) => {
        readFile(filePath, (err, data) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    },
  };
}

export function htmlBundlerWatch(): CrxmBundlerPluginWatch {
  return {
    name: 'HTML File loader watch',
    plugin: async (filePath, sendResult) => {
      const watcher = watch(filePath);

      readFile(filePath, (err, data) => {
        if (err !== null) {
          throw err;
        } else {
          sendResult(data);
        }
      });

      watcher.addListener('change', async () => {
        readFile(filePath, (err, data) => {
          if (err !== null) {
            throw err;
          } else {
            sendResult(data);
          }
        });
      });

      return {
        stop: async () => {
          watcher.close();
        },
      };
    },
  };
}
