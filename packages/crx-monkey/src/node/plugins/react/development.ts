import {
  SockServerRequestSendResult,
  SockServerResponse,
  SockServerResponseContent,
  SockServerResponseHMRReload,
  SockServerResponseReload,
  SockServerResponseSendResult,
} from 'src/node/server/SockServer';

export async function developmentReact(
  websocketAddress: `ws://${string}:${string}`,
  entryPoint: string,
  cacheFileName: string,
) {
  const ws = new WebSocket(websocketAddress);

  ws.addEventListener('open', () => {
    console.log('[crxm] A hmr server connected..');
  });

  ws.addEventListener('close', () => {
    console.log('[crxm] A hmr server disconnected..');
  });

  ws.addEventListener('message', async ({ data }) => {
    const response = JSON.parse(data) as SockServerResponse<SockServerResponseContent>;

    if (response.type === 'connected') {
      if (typeof chrome.runtime === 'undefined') {
        const data: SockServerRequestSendResult = {
          type: 'request_result',
          content: {
            entryPoint,
          },
        };

        ws.send(JSON.stringify(data));
      }
    }

    if (response.type === 'request_result_response') {
      console.log('[crxm] hmr initial loading...');

      const {
        content: { js },
      } = response as SockServerResponseSendResult;

      if (typeof chrome.runtime === 'undefined') {
        // userjs
        await loadByString(js);
      }
    }

    if (response.type === 'reload') {
      const data = response as SockServerResponseReload;

      if (data.content.reloadType === 'HMR_' + entryPoint) {
        const {
          content: {
            data: { js, fileName },
          },
        } = response as SockServerResponse<SockServerResponseHMRReload>;

        console.log('[crxm] hmr loading...');

        if (typeof chrome.runtime === 'undefined') {
          // userjs
          await loadByString(js);
        } else {
          await loadFile(fileName);
        }
      }
    }
  });

  async function loadFile(jsFileName: string) {
    await import(`./${jsFileName}?time=${Date.now()}`);
  }

  async function loadByString(js: string) {
    const s = document.createElement('script');
    s.innerHTML = js;
    document.body.appendChild(s);
  }

  if (typeof chrome.runtime !== 'undefined') {
    await loadFile(cacheFileName);
  }
}
