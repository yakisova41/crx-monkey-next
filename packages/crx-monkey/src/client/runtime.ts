import { waitResultOnce } from './message';
import { CrxmConfigRequired } from '../node/typeDefs';
import { RunningEnv, RunningEnvPrefix } from './main';

export function getRunningRuntime(): 'Userscript' | 'Extension' {
  if (__crxm_running_env.split('-')[0] === 'userjs') {
    return 'Userscript';
  } else {
    return 'Extension';
  }
}

export function getEnv(): {
  prefix: RunningEnvPrefix;
  env: RunningEnv;
} {
  const [prefix, env] = __crxm_running_env.split('-') as [RunningEnvPrefix, RunningEnv];
  return {
    prefix,
    env,
  };
}

export function getRunningWorld() {
  if (getEnv().prefix === 'userjs') {
    throw new Error('Cannot be executed by userscripts');
  }

  if (typeof chrome.runtime.id === 'undefined') {
    return 'MAIN';
  } else {
    return 'ISOLATED';
  }
}

export async function getCrxmConfig() {
  if (getEnv().prefix === 'userjs') {
    throw new Error('Cannot be executed by userscripts');
  }

  const actionId = crypto.randomUUID();

  window.postMessage(
    {
      type: 'get-conf',
      crxContentBuildId: __crxm_build_id,
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
  if (getEnv().prefix === 'userjs') {
    throw new Error('Cannot be executed by userscripts');
  }

  if (getRunningWorld() === 'ISOLATED') {
    return chrome.runtime.id;
  } else {
    const actionId = crypto.randomUUID();

    window.postMessage(
      {
        type: 'get-id',
        crxContentBuildId: __crxm_build_id,
        detail: null,
        actionId,
      },
      '*',
    );
    return await waitResultOnce<string>('get-id', actionId);
  }
}

/**
 * You can check browser's console logs in your terminal at development mode.
 * [ATTENSION] It's unstable future.
 */
export function attachConsole() {
  const replaceOriginal = (original: (...args: string[]) => void, name: string) => {
    return (...args: string[]) => {
      original(...args);

      const actionId = crypto.randomUUID();
      window.postMessage(
        {
          type: name,
          crxContentBuildId: __crxm_build_id,
          detail: args.join(' '),
          actionId,
        },
        '*',
      );
    };
  };

  const l = console.log;
  const w = console.warn;
  const e = console.error;

  window.console.log = replaceOriginal(l, 'console-log');
  window.console.warn = replaceOriginal(w, 'console-warn');
  window.console.error = replaceOriginal(e, 'console-error');
  console.log("[crxm] browser's console attached to your console.");
}

export const runtime = {
  getRunningRuntime,
  getEnv,
  getRunningWorld,
  getExtensionId,
  getCrxmConfig,
  attachConsole,
};
