import { IsolatedConnectorEvent } from 'src/node/isolatedConnector';
import {
  SockServerConsoleRecieved,
  SockServerResponse,
  SockServerResponseReload,
} from 'src/node/server/SockServer';

export function developmentContentScript(
  crxContentBuildId: string,
  host: string,
  websocketPort: number,
) {
  const websocket = new WebSocket(`ws://${host}:${websocketPort}`);

  websocket.addEventListener('open', () => {
    console.log('[crxm] A reload server connected..');
  });

  websocket.addEventListener('close', () => {
    console.log('[crxm] A reload server disconnected..');
  });

  websocket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data) as SockServerResponse<SockServerResponseReload>;

    if (response.type === 'reload') {
      switch (response.content) {
        case 'RELOAD_CSS':
        case 'RELOAD_CONTENT_SCRIPT':
          location.reload();
          break;
        default:
          break;
      }
    }
  });

  window.addEventListener('message', (e: MessageEvent<IsolatedConnectorEvent>) => {
    const { data } = e;

    /**
     * Client can listen a result by using of this.
     */
    const handlers: Record<string, () => void> = {
      'console-log': () => {
        const preload: SockServerConsoleRecieved = {
          type: 'console',
          content: {
            type: 'log',
            contents: data.detail,
          },
        };
        websocket.send(JSON.stringify(preload));
      },
      'console-error': () => {
        const preload: SockServerConsoleRecieved = {
          type: 'console',
          content: {
            type: 'error',
            contents: data.detail,
          },
        };
        websocket.send(JSON.stringify(preload));
      },
      'console-warn': () => {
        const preload: SockServerConsoleRecieved = {
          type: 'console',
          content: {
            type: 'warn',
            contents: data.detail,
          },
        };
        websocket.send(JSON.stringify(preload));
      },
    };

    /**
     * # BuildId Check
     * If a build id of recieved message isn't equiavalent with a buildId of isolatedConnector,
     * wouldn't be runned the handler so It can prevent being runned from other scripts.
     */
    if (data.crxContentBuildId === crxContentBuildId) {
      const handler = handlers[data.type];
      if (handler !== undefined) {
        handler();
      }
    }
  });
}
