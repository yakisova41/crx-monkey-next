import { SockServerResponse, SockServerResponseReload } from 'src/node/server/SockServer';

export function hotreload(host: string, websocketPort: number) {
  const websocket = new WebSocket(`ws://${host}:${websocketPort}`);

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
}

export function isolatedConnector(crxContentBuildId: string, config: string) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
  interface IsolatedConnectorEvent<T extends any = any> {
    type: string;
    crxContentBuildId: string;
    detail: T;
    actionId: string;
  }

  const messageListeners: Record<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request: any, sender: chrome.runtime.MessageSender) => void
  > = {};

  /**
   * How it works?
   *
   * 1. A client (e.g. contentscripts.ts in MAIN world) : dispatch message to window.
   * 2. This EventListener recieved.
   * 3. This EventListener dispatchs CustomEvent that 'crx-isolated-connector-result' to window.
   * 4. A client recieved CustomEvent as result.
   */
  window.addEventListener('message', (e: MessageEvent<IsolatedConnectorEvent>) => {
    const { data, target } = e;

    /**
     * Send event of response to target.
     * @param name custom event name.
     * @param type custom event type.
     * @param detail custom event detail.
     */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
    function dispatch<T extends any = any>(name: string, type: string, detail: T) {
      if (target !== null) {
        target.dispatchEvent(
          new CustomEvent(name, {
            detail: {
              type,
              data: detail,
              actionId: data.actionId,
            },
          }),
        );
      }
    }

    /**
     * Client can listen a result by using of this.
     */
    const responseEventName = 'crx-isolated-connector-result';

    const handlers: Record<string, () => void> = {
      'get-id': () => {
        // Send extension runtime id.
        dispatch(responseEventName, 'get-id', chrome.runtime.id);
      },
      'get-conf': () => {
        // Send crx-monkey config stringified.
        dispatch(responseEventName, 'get-conf', config);
      },
      'on-message': () => {
        // Append a message listener from client.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleMessage = (request: any, sender: chrome.runtime.MessageSender) => {
          dispatch(responseEventName, 'on-message', { request, sender });
        };
        messageListeners[data.actionId] = handleMessage;
        chrome.runtime.onMessage.addListener(handleMessage);
      },
      'remove-on-message': () => {
        // Remove a message listener from client.
        if (messageListeners[data.actionId] !== undefined) {
          chrome.runtime.onMessage.removeListener(messageListeners[data.actionId]);
        }
      },
      'send-message': () => {
        // Send a message from client.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chrome.runtime.sendMessage(data.detail.message, data.detail.options, (response: any) => {
          dispatch(responseEventName, 'send-message', { response });
        });
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
