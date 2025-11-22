import { waitResultOnce } from './message';
import { CrxmConfigRequired } from './typeDefs';

export function getRunningRuntime() {
  if (typeof window.__CRX_CONTENT_BUILD_ID === 'undefined') {
    return 'Userscript';
  } else {
    return 'Extension';
  }
}

export function getRunningWorld() {
  if (getRunningRuntime() === 'Userscript') {
    throw new Error('Cannot be executed by user scripts');
  }

  if (typeof chrome.runtime.id === 'undefined') {
    return 'MAIN';
  } else {
    return 'ISOLATED';
  }
}

export async function getCrxmConfig() {
  if (getRunningRuntime() === 'Userscript') {
    throw new Error('Cannot be executed by user scripts');
  }

  const actionId = crypto.randomUUID();

  window.postMessage(
    {
      type: 'get-conf',
      crxContentBuildId: window.__CRX_CONTENT_BUILD_ID,
      detail: null,
      actionId,
    },
    '*',
  );
  return JSON.parse(await waitResultOnce<string>('get-conf', actionId)) as CrxmConfigRequired;
}

/**
 * Get `chrome.runtime.id`.
 *
 * You can get the extension id everyworld if running script by chrome extension.
 */
export async function getExtensionId() {
  if (getRunningRuntime() === 'Userscript') {
    throw new Error('Cannot be executed by user scripts');
  }

  if (getRunningWorld() === 'ISOLATED') {
    return chrome.runtime.id;
  } else {
    const actionId = crypto.randomUUID();

    window.postMessage(
      {
        type: 'get-id',
        crxContentBuildId: window.__CRX_CONTENT_BUILD_ID,
        detail: null,
        actionId,
      },
      '*',
    );
    return await waitResultOnce<string>('get-id', actionId);
  }
}
export const runtime = { getRunningRuntime, getRunningWorld, getExtensionId, getCrxmConfig };
