import {
  SockServerResponse,
  SockServerResponseHMRReload,
  SockServerResponseReload,
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
    const response = JSON.parse(data) as SockServerResponse<SockServerResponseReload>;
    if (response.type === 'reload') {
      if (response.content.reloadType === 'HMR_' + entryPoint) {
        const {
          content: {
            data: { js },
          },
        } = response as SockServerResponse<SockServerResponseHMRReload>;

        console.log('[crxm] hmr loading...');

        await load(js);
      }
    }
  });

  async function load(jsFileName: string) {
    const module = await import(`./${jsFileName}?time=${Date.now()}`);
  }

  await load(cacheFileName);
}
