import { inject, injectable } from 'inversify';
import { ManifestFactory } from '../manifest/ManifestFactory';
import { CodeInjector } from './CodeInjector';
import { UserscriptHeaderFactory } from './UserscriptHeader';
import { TYPES } from '../types';
import { ConfigLoader } from '../ConfigLoader';

/**
 * Properly bundle each build result as a single user script
 */
@injectable()
export class UserscriptBundler {
  private codeWorkspace: string = '';
  private codeBlocks: Record<string, UserJsCodeBlock | UserJsStyleBlock> = {};

  constructor(
    @inject(TYPES.ManifestFactory) private readonly manifestFactory: ManifestFactory,
    @inject(TYPES.UserscriptHeaderFactory)
    private readonly headerFactory: UserscriptHeaderFactory,
    @inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader,
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
    const codeBlock = new UserJsCodeBlock(jsFilePath, codeBinaly);
    this.codeBlocks[jsFilePath] = codeBlock;
  }

  public addStyle(cssFilePath: string, code: Uint8Array) {
    const codeBlock = new UserJsStyleBlock(cssFilePath, code);
    this.codeBlocks[cssFilePath] = codeBlock;
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
    const codeInjector = new CodeInjector();

    const contentScripts = this.manifestFactory.rawManifest.content_scripts;

    if (contentScripts !== undefined) {
      contentScripts.forEach((contentScript) => {
        codeInjector.addContent(contentScript);
      });
    }

    this.codeWorkspace += codeInjector.getCode();

    return this.codeWorkspace;
  }
}

class UserJsCodeBlock {
  private filePath: string;
  private content: Uint8Array;

  constructor(filePath: string, content: Uint8Array) {
    this.filePath = filePath;
    this.content = content;
  }

  public getFunctionalized() {
    let result = '';

    const text = new TextDecoder().decode(this.content);

    result += `\n// ${this.filePath}\n function ${convertFilePathToFuncName(this.filePath)}() {\n${text}}\n`;

    return result;
  }

  public getFunctionalizedFuncName() {
    return convertFilePathToFuncName(this.filePath);
  }
}

class UserJsStyleBlock {
  private filePath: string;
  private content: Uint8Array;

  constructor(filePath: string, content: Uint8Array) {
    this.filePath = filePath;
    this.content = content;
  }

  public getFunctionalized() {
    let result = '';

    const text = new TextDecoder().decode(this.content);

    result += `\n// ${this.filePath}\n function ${convertFilePathToFuncName(this.filePath)}() {
const e = document.createElement("style");
e.innerHTML = \`${text}\`;
document.head.appendChild(e)
console.log(e)}\n`;

    return result;
  }

  public getFunctionalizedFuncName() {
    return convertFilePathToFuncName(this.filePath);
  }
}

/**
 * File path convert to base64 and it included "=" convert to "$".
 * @param filePath
 * @returns
 */
export function convertFilePathToFuncName(filePath: string) {
  return btoa(filePath).replaceAll('=', '$');
}
