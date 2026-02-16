import {
  SockServerConsoleRecieved,
  SockServerResponse,
  SockServerResponseReload,
} from 'src/node/server/SockServer';
import { IsolatedConnectorEvent } from './extension';

export function userjs(
  host: string,
  port: number,
  websocketPort: number,
  bindGM: boolean,
  disableSock: boolean,
  buildId: string,
  popup: boolean,
  trusted: boolean,
) {
  const __crxm_build_id = buildId;

  if (!disableSock) {
    const websocket = new WebSocket(`ws://${host}:${websocketPort}`);

    websocket.addEventListener('message', ({ data }) => {
      const { type, content } = JSON.parse(data) as SockServerResponse<SockServerResponseReload>;

      if (type === 'reload') {
        switch (content.reloadType) {
          case 'RELOAD_CSS':
          case 'RELOAD_CONTENT_SCRIPT':
            console.log('[crxm] reloading...');
            location.reload();

            break;

          default:
            break;
        }
      }
    });

    websocket.addEventListener('open', () => {
      console.log('[crxm] A reload server connected..');

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
        if (data.crxContentBuildId === buildId) {
          const handler = handlers[data.type];
          if (handler !== undefined) {
            handler();
          }
        }
      });
    });

    websocket.addEventListener('close', () => {
      console.log('[crxm] A reload server disconnected..');
    });
  }

  function watchScriptDiff(initialCode: string) {
    const scriptContentTmp = initialCode;

    setInterval(() => {
      getResponse().then((code) => {
        if (scriptContentTmp !== code) {
          location.reload();
        }
      });
    }, 1000);

    return scriptContentTmp;
  }

  async function getResponse() {
    return new Promise((resolve) => {
      GM.xmlHttpRequest({
        url: `http://${host}:${port}/userscript`,
        onload: (e) => {
          resolve(e.responseText);
        },
      });
    });
  }

  let loaded = false;
  document.addEventListener('DOMContentLoaded', () => {
    loaded = true;
  });

  getResponse().then((code) => {
    if (typeof code === 'string') {
      if (disableSock) {
        watchScriptDiff(code);
      }

      const injectCode = code;

      /*
        if (bindGM) {
          const bindGMverName = btoa(crypto.randomUUID()).replaceAll('=', '$');
          unsafeWindow[bindGMverName] = GM;
          injectCode = `const ${bindGMHash} = window["${bindGMverName}"];` + injectCode;
        }
        */

      const scriptElem = document.createElement('script');

      if (trusted) {
        if (unsafeWindow.trustedTypes !== undefined) {
          const policy = unsafeWindow.trustedTypes.createPolicy('crxm-trusted-inject-policy', {
            createScript: (input) => input,
          });
          scriptElem.text = policy.createScript(injectCode.toString());
        } else {
          // For firefox
          scriptElem.textContent = injectCode;
        }
      } else {
        scriptElem.textContent = injectCode;
      }

      unsafeWindow.document.head.appendChild(scriptElem);

      if (loaded) {
        document.dispatchEvent(new Event('crxm_DOMContentLoaded'));
      }
    }
  });

  /**
   * Popup
   */
  if (popup) {
    GM.registerMenuCommand(
      'Open popup',
      () => {
        unsafeWindow.__crxm__popup[buildId]();
      },
      '1',
    );
  }
}
