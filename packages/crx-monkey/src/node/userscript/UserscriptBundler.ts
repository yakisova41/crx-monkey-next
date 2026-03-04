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
      const popupFrame = document.createElement("iframe");
      popupFrame.id = "crxm__popup";
      popupFrame.src = url;
      popupFrame.sandbox = "allow-scripts"
      popupFrame.style.position = "fixed"
      popupFrame.style.top = "20px";
      popupFrame.style.right = "20px";
      popupFrame.style.zIndex = "9999";
      popupFrame.style.background = "light-dark(#fff, #333)";
      popupFrame.style.border = "none";
      popupFrame.style.height = "200px";
      popupFrame.addEventListener('mouseleave', () => {
        popupFrame.remove();
      }); 
      return popupFrame;   
    }


    if(window.__crxm__popup === undefined) {
      window.__crxm__popup = {};    
    }

    let popup = null;
    window.__crxm__popup["${this.buildID}"] = {
      open: () => {
        popup = makePopupElement();
        document.body.appendChild(popup);
      },
      close: () => {
        popup.remove();
        popup = null;
      },
    };
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

    // Inject crxm vars
    const varinjection = [
      `var __crxm_build_id = "${this.buildId}"`,
      `var __crxm_running_env = 'userjs-userjs_script'`,
    ].join('\n');

    result += `\n// ${this.filePath}\n function ${this.funcName}() {\n${varinjection}\n${text}}\n`;

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
      result += `\n// ${this.filePath}\n function ${this.funcName}() {\n${text}}\n GM.registerMenuCommand("Open Popup", () => {unsafeWindow.__crxm__popup["${this.buildId}"].open();\n}, '1');\n`;
    }

    return result;
  }
}
