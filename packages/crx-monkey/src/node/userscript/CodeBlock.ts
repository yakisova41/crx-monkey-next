export class Codeblock {
  private _filePath: string;
  private _content: Uint8Array;
  private _funcName: string;
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

  constructor(filePath: string, content: Uint8Array, buildId: string) {
    this._filePath = filePath;
    this._content = content;
    this._funcName = convertFilePathToFuncName(this._filePath);
    this.buildId = buildId;
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
