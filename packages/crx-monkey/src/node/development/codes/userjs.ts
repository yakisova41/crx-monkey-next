export function userjs(
  host: string,
  port: number,
  websocketPort: number,
  bindGM: boolean,
  disableSock: boolean,
) {
  if (!disableSock) {
    const websocket = new WebSocket(`ws://${host}:${websocketPort}`);

    websocket.addEventListener('message', ({ data }) => {
      switch (data) {
        case 'RELOAD_CSS':
        case 'RELOAD_CONTENT_SCRIPT':
          location.reload();
          break;

        default:
          break;
      }
    });
  }

  function watchScriptDiff(initialCode: string) {
    const scriptContentTmp = initialCode;

    setInterval(() => {
      getResponse().then((code) => {
        if (scriptContentTmp !== code) {
          location.reload();
        }
      });
    }, 1000);

    return scriptContentTmp;
  }

  async function getResponse() {
    return new Promise((resolve) => {
      GM.xmlHttpRequest({
        url: `http://${host}:${port}/userscript`,
        onload: (e) => {
          resolve(e.responseText);
        },
      });
    });
  }

  getResponse().then((code) => {
    if (typeof code === 'string') {
      if (disableSock) {
        watchScriptDiff(code);
      }

      const injectCode = code;

      /*
        if (bindGM) {
          const bindGMverName = btoa(crypto.randomUUID()).replaceAll('=', '$');
          unsafeWindow[bindGMverName] = GM;
          injectCode = `const ${bindGMHash} = window["${bindGMverName}"];` + injectCode;
        }
        */

      const scriptElem = document.createElement('script');
      scriptElem.textContent = injectCode;
      unsafeWindow.document.body.appendChild(scriptElem);
    }
  });
}
