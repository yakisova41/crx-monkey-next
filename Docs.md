# CRX MONKEY Docs

The framework that enables building a browser extension and a userscript with the same code.

## Config file

The config must be named as `crxm.config.js`

```js
// @ts-check
import { defineConfig } from 'crx-monkey';

const config = defineConfig({
  public: './public',
  header: [['@author', 'developer']],
});

export default config;
```

### output

```ts
{
  output?: {
    /**
     * Directory of outputs.
     */
    chrome?: string;
    /**
     * The path containing the filename of the output userscript.
     */
    userjs?: string;
  }
}
```

#### chrome

You can designation a directory for output the extension.

#### userjs

You can designation a directory for output the userscript.

#### manifest

```ts
{
  manifest?: string;
}
```

You can designation a file for using as manifest.

> [!CAUTION]
> Manifest is not a json file but a js file specific to crx-monkey. This is explained later.

### server

```ts
{
  server: {
    port?: number;
    host?: string;
    websocket?: number;
    disable_sock_in_userjs?: boolean;
  }
}
```

Configuration settings for the local development server.

- **port**: The port number for the file server.
- **host**: The hostname used by both the file server and the socket server (e.g., `localhost`).
- **websocket**: The port number specifically for the WebSocket connection used for Hot reloading.
- **disable_sock_in_userjs**: If set to `true`, it disables the WebSocket connection in development userscript.

### header

```ts
{
  header: [['@props', 'value']];
}
```

Defines the metadata block for the UserScript (e.g., `@name`, `@match`, `@grant`). This is used to generate the header comment block in the output userscirpt file.

### build

```ts
{
  build: Record<string, CrxmBundlerPlugin>;
}
```

Configure build plugins for specific files.
The key is a regular expression string to match filenames, and the value is the plugin definition.

### watch

```ts
{
  watch: Record<string, CrxmBundlerPluginWatch>;
}
```

Configure plugins specifically for watch mode.
Similar to `build`, the key is a regular expression string to match filenames.

### logLevel

```ts
{
  logLevel: 'info' | 'error' | 'debug';
}
```

Controls the verbosity of the console output during the build process.

- **`info`**: Shows only general information and success messages.
- **`error`**: Shows information and errors.
- **`debug`**: Shows all logs, including detailed debugging information dispatched by the system.

### public

```ts
{
  public: string | false;
}
```

Specifies a directory path that will be copied as-is to the `public` folder in the output directory (dist).
Set this to `false` to disable static asset copying.

### define

```ts
{
  define: {
    sw?: Record<string, string>;
    contentscripts?: Record<string, string>;
    popup?: Record<string, string>;
  }
}
```

Defines global variables (constants) that will be replaced at build time. This allows you to inject different values depending on the context of the script.

- **sw**: Definitions applied to the Service Worker (Background script).
- **contentscripts**: Definitions applied to Content Scripts.
- **popup**: Definitions applied to the Popup script.

#### Example

```js
define: {
  contentscripts: {
    'process.env.NODE_ENV': '"production"',
    '__API_URL__': '"[https://api.example.com](https://api.example.com)"'
  }
}
```

### Manifest

## Manifest

In crx-monkey, the manifest is defined as a JavaScript file (typically `manifest.js`), not a JSON file. This allows you to use helper functions for type inference and directly reference source files (like TypeScript or SCSS) which will be bundled automatically.

The manifest file must export the configuration using `export default`.

### Example

`manifest.js`

```js
// @ts-check
import { defineManifest } from 'crx-monkey';

export default defineManifest({
  manifest_version: 3,
  name: 'My Extension',
  version: '1.0.0',
  description: 'My extension description',
  content_scripts: [
    {
      js: ['content_scripts/main.ts'],
      css: ['content_scripts/style.scss'],
      matches: ['<all_urls>'],
      userscript_direct_inject: false,
      use_isolated_connection: true,
    },
  ],
  background: {
    service_worker: 'sw/main.ts',
  },
  action: {
    default_popup: 'popup/index.html',
  },
  icons: {
    16: './assets/icons/icon16.png',
    48: './assets/icons/icon48.png',
    128: './assets/icons/icon128.png',
  },
});
```

### Content Scripts

The `content_scripts` field extends the standard Chrome Manifest V3 `content_scripts` with additional properties specific to crx-monkey and UserScript generation.

You can specify source paths (e.g., `.ts`, `.scss`) in `js` and `css` arrays. The bundler will compile them and update the final manifest automatically.

```ts
interface CrxmContentScript {
  // Standard properties
  matches?: string[];
  exclude_matches?: string[];
  css?: string[];
  js?: string[];
  run_at?: 'document_start' | 'document_end' | 'document_idle';
  all_frames?: boolean;
  match_about_blank?: boolean;
  include_globs?: string[];
  exclude_globs?: string[];
  world?: 'ISOLATED' | 'MAIN';

  // Custom properties
  userscript_direct_inject?: boolean;
  trusted_inject?: boolean;
  use_isolated_connection?: boolean;
}
```

#### Custom Properties

- **userscript_direct_inject** (`boolean`):
  Controls how the script is injected when building for UserScript (Tampermonkey/Greasemonkey). If true, it attempts to inject the code directly into the page context.

- **trusted_inject** (`boolean`):
  Enables trusted injection methods, useful when dealing with strict Content Security Policies (CSP).

- **use_isolated_connection** (`boolean`):
  If set to `true`, it establishes a connection bridge between the isolated world (content script) and the background/main context. This is required for passing messages from main world world to isolated world or sw

### Background

```ts
background: {
  service_worker: string;
  type?: string; // e.g. 'module'
}
```

Define the entry point for the background service worker. Points to your TypeScript/JavaScript source file.

## Client API

The client module provides utilities to help your code run seamlessly across different contexts: Chrome Extension (Isolated World), Chrome Extension (Main World), and UserScript.

These modules handle the complexity of message passing and context detection, allowing you to use extension-like APIs even inside the Main World.

```ts
import { runtime, message, i18n } from 'crx-monkey/client';
```

### Runtime

Utilities to detect the current execution environment and retrieve extension information.

#### `getRunningRuntime()`

Determines if the code is running as a Chrome Extension or a UserScript.

```ts
function getRunningRuntime(): 'Extension' | 'Userscript';
```

- **Returns**: `'Extension'` if running within a Chrome Extension context, otherwise `'Userscript'`.

#### `getRunningWorld()`

Determines the JavaScript world the code is running in.

> [!NOTE]
> This function throws an error if called within a UserScript context.

```ts
function getRunningWorld(): 'ISOLATED' | 'MAIN';
```

- **Returns**: `'ISOLATED'` if `chrome.runtime.id` is present (Content Script), otherwise `'MAIN'` (Injected Script).

#### `getExtensionId()`

Retrieves the Chrome Extension ID.
Unlike `chrome.runtime.id`, this function works even in the **Main World** by communicating with the Isolated World.

```ts
async function getExtensionId(): Promise<string>;
```

#### `getCrxmConfig()`

Retrieves the `crx-monkey` configuration object defined in `crxm.config.js`.
This works by messaging the content script (if in Main World) to fetch the config injected at build time.

> [!NOTE]
> This function throws an error if called within a UserScript context.

```ts
async function getCrxmConfig(): Promise<CrxmConfigRequired>;
```

#### `attachConsole()`

Proxies `console.log`, `console.warn`, and `console.error` from the browser to your terminal during development.
This is useful for debugging scripts running in the Main World where console output might be cluttered or hard to reach from the extension context.

> [!WARNING]
> This is an experimental/unstable feature.

```ts
function attachConsole(): void;
```

---

### Message

A bridge for message passing between the Content Script (Main World/Isolated World) and the Background Service Worker.
These functions bypass the limitations of `chrome.runtime` not being available in the Main World.

> [!WARNING]
> To use this feature, enable use_isolated_connection in your manifest.

> [!WARNING]
> Not available in userscript

#### `sendMessage()`

Sends a message to the Service Worker (Background).
It mimics `chrome.runtime.sendMessage` and handles the bridging between Main World and Isolated World if necessary.

```ts
async function sendMessage<T = any, U = any>(
  message: T,
  options?: object,
  callback?: (response: U) => void,
): Promise<void>;
```

- **message**: The message payload to send.
- **callback**: Function called when the background script responds.

#### `addListener()`

Listens for messages sent from the Background script (or other parts of the extension).
It mimics `chrome.runtime.onMessage.addListener`.

```ts
function addListener<T = any>(
  callback: (request: T, sender: chrome.runtime.MessageSender) => void,
): { remove: () => void };
```

- **callback**: Function called when a message is received.
- **Returns**: An object with a `remove()` method to stop listening.

---

### I18n

Wrappers for `chrome.i18n` API.

> [!IMPORTANT]
> These functions currently only work within the **Extension Isolated World**. In other contexts (Main World or UserScript), they will return `undefined`.

#### `getMessage()`

Gets the localized string for the specified message.

```ts
function getMessage(messageName: string, substitutions?: string | string[]): string | undefined;
```

#### `detectLanguage()`

Detects the language of the provided text.

```ts
async function detectLanguage(text: string): Promise<chrome.i18n.DetectedLanguage | undefined>;
```

#### `getAcceptLanguages()`

Gets the accept-languages of the browser.

```ts
async function getAcceptLanguages(): Promise<string[] | undefined>;
```

#### `getUILanguage()`

Gets the browser UI language.

```ts
function getUILanguage(): string | undefined;
```
