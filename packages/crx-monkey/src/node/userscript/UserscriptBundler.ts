import { inject, injectable } from 'inversify';
import { ManifestFactory } from '../manifest/ManifestFactory';
import { CodeInjector } from './CodeInjector';
import { UserscriptHeaderFactory } from './UserscriptHeader';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';
import { Codeblock, I_Codeblock } from './CodeBlock';

/**
 * Properly bundle each build result as a single user script
 */
@injectable()
export class UserscriptBundler {
  private codeWorkspace: string = '';
  private codeBlocks: Record<string, I_Codeblock> = {};
  private popupFunctionName!: string;

  constructor(
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.UserscriptHeaderFactory)
    private readonly headerFactory: UserscriptHeaderFactory,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
    @inject(TYPES.BuildID) private readonly buildID: string,
    @inject(TYPES.IsWatch) private readonly isWatch: boolean,
  ) {}

  public initialize() {
    this.codeBlocks = {};
    this.codeWorkspace = '';
  }

  /**
   * Add build result.
   * @param jsFilePath
   * @param codeBinaly
   */
  public addBuildResult(jsFilePath: string, codeBinaly: Uint8Array) {
    const codeBlock = new UserJsCodeBlock(jsFilePath, codeBinaly, this.buildID);
    this.codeBlocks[jsFilePath] = codeBlock;
  }

  public addStyle(cssFilePath: string, code: Uint8Array, trusted: boolean) {
    const codeBlock = new UserJsStyleBlock(cssFilePath, code, this.buildID, trusted);
    this.codeBlocks[cssFilePath] = codeBlock;
  }

  public addPopup(filePath: string, html: string) {
    const code = `const html = \`${html}\`;

    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);

    function makePopupElement(){
      const popup = document.createElement("iframe");
      popup.id = "crxm__popup";
      popup.src = url;
      popup.sandbox = "allow-scripts"
      popup.style.position = "fixed"
      popup.style.top = "20px";
      popup.style.right = "20px";
      popup.style.zIndex = "9999";
      popup.style.background = "light-dark(#fff, #333)";
      popup.style.border = "none";
      popup.style.height = "200px";
      popup.addEventListener('mouseleave', () => {
        popup.remove();
      }); 
      return popup;   
    }


    window.__crxm__popup = {};
    window.__crxm__popup["${this.buildID}"] = () => {
      const popup = makePopupElement();
      document.body.appendChild(popup);
    }
    `;

    const e = new TextEncoder();

    const binary = e.encode(code);

    const codeBlock = new UserJsPopupBlock(filePath, binary, this.buildID, this.isWatch);
    this.codeBlocks[filePath] = codeBlock;

    this.popupFunctionName = codeBlock.funcName;
  }

  public createCode() {
    this.codeWorkspace = '';

    /**
     * Insert Header
     */
    this.codeWorkspace += this.headerFactory.toString() + '\n';

    /**
     * Insert functioned build results.
     */
    Object.keys(this.codeBlocks).forEach((filePath) => {
      const codeBlock = this.codeBlocks[filePath];
      const functionalized = codeBlock.getFunctionalized();
      this.codeWorkspace += functionalized;
    });

    /**
     * Insert inject method.
     */
    const codeInjector = new CodeInjector(this.isWatch);

    const contentScripts = this.manifestFactory.rawManifest.content_scripts;

    if (contentScripts !== undefined) {
      contentScripts.forEach((contentScript) => {
        codeInjector.addContent(contentScript);
      });
    }

    if (this.popupFunctionName !== undefined) {
      codeInjector.addPopup(this.popupFunctionName);
    }

    this.codeWorkspace += codeInjector.getCode();

    return this.codeWorkspace;
  }
}

class UserJsCodeBlock extends Codeblock implements I_Codeblock {
  public getFunctionalized() {
    let result = '';

    const text = new TextDecoder().decode(this.content);

    result += `\n// ${this.filePath}\n function ${this.funcName}() {\n${text}}\n`;

    return result;
  }
}

class UserJsStyleBlock extends Codeblock implements I_Codeblock {
  constructor(
    filePath: string,
    binary: Uint8Array,
    buildID: string,
    private trusted: boolean,
  ) {
    super(filePath, binary, buildID);
  }
  public getFunctionalized() {
    let result = '';

    const text = new TextDecoder().decode(this.content);

    if (this.trusted) {
      result += `\n// ${this.filePath}\n function ${this.funcName}() {
        if (window.trustedTypes !== undefined) {
          const e = document.createElement("style");
          const policy = window.trustedTypes.createPolicy('crxm-trusted-inject-policy', {
            createScript: (input) => input,
          });
          e.text = policy.createScript(\`${text}\`);
          document.head.appendChild(e)
    }}\n`;
    } else {
      result += `\n// ${this.filePath}\n function ${this.funcName}() {
        const e = document.createElement("style");
        e.innerHTML = \`${text}\`;
        document.head.appendChild(e)}\n`;
    }

    return result;
  }
}

class UserJsPopupBlock extends Codeblock implements I_Codeblock {
  constructor(
    filePath: string,
    binary: Uint8Array,
    buildID: string,
    private iswatch: boolean,
  ) {
    super(filePath, binary, buildID);
  }

  public getFunctionalized() {
    let result = '';

    const text = new TextDecoder().decode(this.content);

    if (this.iswatch) {
      result += `\n// ${this.filePath}\n function ${this.funcName}() {\n${text}}\n`;
    } else {
      result += `\n// ${this.filePath}\n function ${this.funcName}() {\n${text}}\nGM_registerMenuCommand("Open Popup", () => {unsafeWindow.__crxm__popup["${this.buildId}"]();\n});\n`;
    }

    return result;
  }
}
