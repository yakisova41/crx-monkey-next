import { CrxmBundlerPlugin, CrxmBundlerPluginWatch } from '../typeDefs';
import { watch, readFile } from 'fs';

export const htmlBundler: CrxmBundlerPlugin = {
  name: 'html bundler watch',
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

export const htmlBundlerWatch: CrxmBundlerPluginWatch = {
  name: 'html bundler watch',
  plugin: async (filePath, sendResult) => {
    const watcher = watch(filePath);

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
