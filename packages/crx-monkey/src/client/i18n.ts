import { runtime } from './api';

/**
 * Gets the localized string for the specified message. If the message is missing, this method returns an empty string (''). If the format of the getMessage() call is wrong — for example, messageName is not a string or the substitutions array has more than 9 elements — this method returns undefined.
 * @param messageName
 * @param substitutions
 * @returns
 */
function getMessage(messageName: string, substitutions?: string | string[] | undefined) {
  if (runtime.getRunningRuntime() === 'Extension') {
    if (runtime.getRunningWorld() === 'ISOLATED') {
      return chrome.i18n.getMessage(messageName, substitutions);
    }
  }
}

async function detectLanguage(text: string) {
  if (runtime.getRunningRuntime() === 'Extension') {
    if (runtime.getRunningWorld() === 'ISOLATED') {
      return chrome.i18n.detectLanguage(text);
    }
  }
}

async function getAcceptLanguages() {
  if (runtime.getRunningRuntime() === 'Extension') {
    if (runtime.getRunningWorld() === 'ISOLATED') {
      return chrome.i18n.getAcceptLanguages();
    }
  }
}

function getUILanguage() {
  if (runtime.getRunningRuntime() === 'Extension') {
    if (runtime.getRunningWorld() === 'ISOLATED') {
      return chrome.i18n.getUILanguage();
    }
  }
}

export const i18n = { getMessage, detectLanguage, getAcceptLanguages, getUILanguage };
export default i18n;
