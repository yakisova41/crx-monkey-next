export function waitResult<T = string>(
  type: string,
  actionId: string,
  callback: (data: T) => void,
) {
  const onResult = (e: IsolateConnectorEvent<T>) => {
    if (e.detail.type === type && e.detail.actionId === actionId) {
      callback(e.detail.data);
    }
  };

  window.addEventListener('crx-isolated-connector-result', onResult);

  return {
    remove: () => {
      window.removeEventListener('crx-isolated-connector-result', onResult);
    },
  };
}

export async function waitResultOnce<T = string>(type: string, actionId: string): Promise<T> {
  return new Promise((resolve) => {
    const onResult = (e: IsolateConnectorEvent<T>) => {
      if (e.detail.type === type && e.detail.actionId === actionId) {
        window.removeEventListener('crx-isolated-connector-result', onResult);
        resolve(e.detail.data);
      }
    };

    window.addEventListener('crx-isolated-connector-result', onResult);
  });
}

export type IsolateConnectorEvent<T> = CustomEvent<{
  type: string;
  actionId: string;
  data: T;
}>;

/**
 * Bypass `chrome.runtime.sendMessage`.
 *
 * You can send message to service worker.
 * @param callback
 */
async function sendMessage<T = never, U = never>(
  message: T,
  options?: object,
  callback?: (response: U) => void,
) {
  const actionId = crypto.randomUUID();

  window.postMessage(
    {
      type: 'send-message',
      crxContentBuildId: __crxm_build_id,
      detail: { message, options },
      actionId,
    },
    '*',
  );

  const data = await waitResultOnce<{ response: U }>('send-message', actionId);
  if (callback !== undefined) {
    callback(data.response);
  }
}

/**
 * Bypass `chrome.runtime.onMessage`.
 *
 * You can get a content of message receved the bypassing isolated content_script.
 * @param callback
 */
function addListener<T = never>(
  callback: (request: T, sender: chrome.runtime.MessageSender) => void,
): {
  remove: () => void;
} {
  const actionId = crypto.randomUUID();

  window.postMessage(
    {
      type: 'on-message',
      crxContentBuildId: __crxm_build_id,
      detail: null,
      actionId,
    },
    '*',
  );

  const waiter = waitResult<{ request: T; sender: { id: string; origin: string } }>(
    'on-message',
    actionId,
    (data) => {
      callback(data.request, data.sender);
    },
  );

  return {
    remove: () => {
      waiter.remove();

      window.postMessage(
        {
          type: 'remove-on-message',
          crxContentBuildId: __crxm_build_id,
          detail: null,
          actionId,
        },
        '*',
      );
    },
  };
}

export const message = { sendMessage, addListener };
export default message;
