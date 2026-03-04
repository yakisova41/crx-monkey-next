import { getEnv } from './main';

export function open() {
  if (getEnv().prefix !== 'userjs') {
    throw new Error('This feature is only available in the userjs environment.');
  }

  if (getEnv().env === 'html_script' || getEnv().env === 'html_script_react') {
    throw new Error('This feature cannot be used in the popup environment.');
  }

  const p = window.__crxm__popup[__crxm_build_id];

  if (p === undefined) {
    throw new Error('No popup is registered for this script.');
  }

  p.open();
}

export function close() {
  if (getEnv().prefix !== 'userjs') {
    throw new Error('This feature is only available in the userjs environment.');
  }

  if (getEnv().env === 'html_script' || getEnv().env === 'html_script_react') {
    throw new Error('This feature cannot be used in the popup environment.');
  }

  const p = window.__crxm__popup[__crxm_build_id];

  if (p === undefined) {
    throw new Error('No popup is registered for this script.');
  }

  p.close();
}

export const popup = { open, close };
export default popup;
