import { inject, injectable } from 'inversify';
import { WebSocketServer, type WebSocket } from 'ws';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';
import { Logger } from '../Logger';
import chalk from 'chalk';

/**
 * The websocket server of manage auto reload.
 */
@injectable()
export class SockServer {
  private readonly wserver: WebSocketServer;
  private listeners: SockServerLisntener[] = [];

  /**
   * Start and setup server.
   * @param host
   * @param port
   */
  constructor(
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.Logger) private readonly logger: Logger,
  ) {
    const {
      server: { host, websocket },
    } = this.configLoader.useConfig();

    this.wserver = new WebSocketServer({
      port: websocket,
      host: host,
    });

    //this.setup();
  }

  public addMsgListener(listener: SockServerLisntener) {
    this.listeners.push(listener);
  }

  private dispatch<T extends SockRecieveContent>(msg: SockRecieve<T>) {
    this.listeners.forEach((l) => {
      l(msg);
    });
  }

  public setup() {
    this.wserver.on('connection', (socket) => {
      this.sendMsg<SockServerResponseConnected>(socket, {
        type: 'connected',
        content: null,
      });

      socket.addEventListener('message', (e) => {
        if (typeof e.data === 'string') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: SockRecieve<any> = JSON.parse(e.data);
          this.dispatch(data);
        }
      });
    });
  }

  /**
   * Send reload signal to websocket client.
   * @param token
   */
  public reload(token: ReloadTokens) {
    this.wserver.clients.forEach((client) => {
      this.sendMsg<SockServerResponseReload>(client, {
        type: 'reload',
        content: token,
      });
    });

    this.logger.dispatchDebug(`🔃 Dispatch reload ${chalk.gray('"' + token + '"')}`);
  }

  public sendMsg<T extends SockServerResponseContent>(
    socket: WebSocket,
    data: SockServerResponse<T>,
  ) {
    socket.send(JSON.stringify(data));
  }

  public dispose() {
    this.wserver.close();
  }
}

export interface SockServerResponseConnected extends SockServerResponseContent {
  type: 'connected';
  content: null;
}

export interface SockServerResponseReload extends SockServerResponseContent {
  type: 'reload';
  content: ReloadTokens;
}
export type ReloadTokens =
  | 'RELOAD_CONTENT_SCRIPT'
  | 'RELOAD_CSS'
  | 'RELOAD_SW'
  | 'RELOAD_POPUP_JS'
  | 'RELOAD_POPUP_HTML'
  | 'ALL';

export interface SockServerResponse<T extends SockServerResponseContent> {
  type: T['type'];
  content: T['content'];
}
export interface SockServerResponseContent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
}

export interface SockServerConsoleRecieved extends SockRecieveContent {
  type: 'console';
  content: {
    type: 'log' | 'warn' | 'error';
    contents: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SockServerLisntener = <T extends SockRecieveContent>(msg: SockRecieve<T>) => any;
export interface SockRecieve<T extends SockRecieveContent> {
  type: T['type'];
  content: T['content'];
}
export interface SockRecieveContent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
}
