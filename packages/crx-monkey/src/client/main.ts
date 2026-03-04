/**
 * The main endpoint for client of crx-monkey.
 * Modules and Types that are exported from this file are used by userside.
 */

import { CrxmUserjsPopup } from '../node/typeDefs';
import { IsolateConnectorEvent } from './message';

export * from './message';
export * from './i18n';
export * from './runtime';
export * from './popup';

export type RunningEnvPrefix = 'userjs' | 'chrome';
export type RunningEnv = 'html_script_react' | 'html_script' | 'sw' | 'content' | 'userjs_script';

declare global {
  const __crxm_build_id: string;
  const __crxm_running_env: `${RunningEnvPrefix}-${RunningEnv}`;
  interface WindowEventMap {
    'crx-isolated-connector-result': IsolateConnectorEvent<never>;
  }
  interface Window {
    __crxm__popup: Record<typeof __crxm_build_id, CrxmUserjsPopup>;
  }
}
