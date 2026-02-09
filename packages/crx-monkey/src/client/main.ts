/**
 * The main endpoint for client of crx-monkey.
 * Modules and Types that are exported from this file are used by userside.
 */

import { IsolateConnectorEvent } from './message';

export * from './message';
export * from './i18n';
export * from './runtime';

declare global {
  const __crxm_build_id: string;
  interface WindowEventMap {
    'crx-isolated-connector-result': IsolateConnectorEvent<never>;
  }
}
