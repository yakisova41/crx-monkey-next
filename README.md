# CRX MONKEY (next) 🐵

> [!NOTE]
> This is an alpha version of crx-monkey, which has been completely reworked. It will be released as crx-monkey in the future.


<img src="https://raw.githubusercontent.com/yakisova41/crx-monkey/main/docs/static/img/logo.svg" width="150px">

Build Typescript into Chrome extension and Userscript

This is the build system created for [Return YouTube Comment Username
](https://github.com/yakisova41/return-youtube-comment-username).

[Documentation](https://github.com/yakisova41/crx-monkey-next/blob/main/Docs.md)

[Example](https://github.com/yakisova41/crx-monkey-next/tree/main/dev)
## Feature

- The same code can be used in Chrome extension and userscript.
- Typescript can be used.
- The page, service_worker, and popup are automatically reloaded during development.
- You can also automatically inject code directly into your pages.
- Message passing from MAIN world to service_worker is available.
- Highspeed build by esbuild.
- Display a popup on a Userscript using the same code as the extension
- You can define a Loader to transpile various files (such as sass).

## How to use
### 1. Install crx-monkey-next
```sh
bun install crx-monkey-next
```

### 2. Create `crxm.config.js`, Export config as default
```js
// @ts-check
import { defineConfig } from "crx-monkey-next"

export default defineConfing({})
```

### 3. Create `manifest.js`, Export manifest as default
```js
// @ts-check
import { defineManifest } from "crx-monkey-next"

export default defineManifest({
  name : "name",
  version: "1.0.0",
  manifest_version: 3,
  description: "description",
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/contentScripts.ts"],
      world: "MAIN",
    },
  ],
})
```
### 4. Run development mode
```sh
bunx crx-monkey-next dev
```
