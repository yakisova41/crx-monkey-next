import express from 'express';
import { resolve, dirname, isAbsolute } from 'path';
import fse from 'fs-extra';
import * as http from 'http';
import consola from 'consola';
import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';
/*
/**
 * The server of send to script code.
 */
@injectable()
export class FileServer {
  private readonly app: express.Express;
  private server: null | http.Server = null;

  constructor(@inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader) {
    const {
      server: { host, port },
    } = this.configLoader.useConfig();
    if (host === undefined || port === undefined) {
      throw new Error("Server host, port or  websocket's port were not specificated");
    }

    this.app = express();
  }

  /**
   * Start server.
   * @returns
   */
  public async start() {
    this.setup();

    const {
      server: { host, port },
    } = this.configLoader.useConfig();

    if (host === undefined || port === undefined) {
      throw new Error("Server host, port or  websocket's port were not specificated");
    }

    return new Promise((resolve) => {
      this.server = this.app.listen(port, host, () => {
        resolve(1);
      });
    });
  }

  public async dispose() {
    if (this.server === null) {
      throw consola.error(new Error('Dispose can be used after Watch is started'));
    }

    this.server.close();
    this.server = null;
  }

  private setup() {
    const {
      output: { chrome, userjs },
      manifest,
    } = this.configLoader.useConfig();

    if (chrome === undefined || userjs === undefined) {
      throw new Error('');
    }

    this.app.get('/userscript', (req, res) => {
      let filepath = userjs;

      if (!isAbsolute(userjs)) {
        filepath = resolve(dirname(manifest), userjs);
      }

      if (fse.existsSync(filepath)) {
        res.sendFile(filepath);
      } else {
        res.send(400);
      }
    });

    this.app.get('/dev.user.js', (req, res) => {
      let filepath = userjs;

      if (!isAbsolute(userjs)) {
        filepath = resolve(dirname(manifest), dirname(userjs), 'dev.user.js');
      }
      if (fse.existsSync(filepath)) {
        res.sendFile(filepath);
      } else {
        res.send(400);
      }
    });
  }
}
