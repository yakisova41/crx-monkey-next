import { Define } from '../BundlerRegisterer';
import { FilePath } from '../typeDefs';

export class Codeblock {
  private _filePath: FilePath<'absolute'>;
  private _content: Uint8Array;
  private _funcName: string;
  private _define: Define[] = [];
  protected buildId: string;

  public get filePath() {
    return this._filePath;
  }

  public get content() {
    return this._content;
  }

  public get funcName() {
    return this._funcName;
  }

  public get define() {
    return this._define;
  }

  constructor(
    filePath: FilePath<'absolute'>,

    content: Uint8Array,
    buildId: string,
    define?: Define[],
  ) {
    this._filePath = filePath;
    this._content = content;
    this._funcName = convertFilePathToFuncName(this._filePath);
    this.buildId = buildId;
    this._define = define === undefined ? [] : define;
  }
}

export interface I_Codeblock {
  getFunctionalized(): void;
}

/**
 * File path convert to base64 and it included "=" convert to "$".
 * @param filePath
 * @returns
 */
export function convertFilePathToFuncName(filePath: string) {
  return btoa(filePath).replaceAll('=', '$');
}
