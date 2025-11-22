import { injectable } from 'inversify';
import { UserScriptHeader, UserScriptHeaderProps } from 'src/client/typeDefs';

@injectable()
export class UserscriptHeaderFactory {
  private detail: UserScriptHeader = [];

  constructor(selfInstance: UserscriptHeaderFactory | null = null) {
    if (selfInstance !== null) {
      this.initialize();
      this.detail = structuredClone(selfInstance.detail);
    }
  }

  public initialize() {
    this.detail = [];
  }

  /**
   * Push header item.
   * @param key
   * @param value
   */
  public push(key: keyof UserScriptHeaderProps, value: string) {
    // The name should be at the beginning of the metadata.
    if (key !== undefined && key.toString().match(/^@name/)) {
      this.detail.unshift([key, value]);
    } else {
      this.detail.push([key, value]);
    }
  }

  /**
   * Output created header.
   * @returns Userscript header string.
   */
  public toString() {
    const header: string[] = [];

    header.push('// ==UserScript==');

    this.detail.forEach(([key, value]) => {
      header.push(`// ${key} ${value}`);
    });

    header.push('// ==/UserScript==');
    return header.join('\n');
  }

  /**
   * Replace header item.
   * @param key
   * @param value
   */
  public replace(key: keyof UserScriptHeaderProps, value: string) {
    this.detail.forEach(([detailKey], index) => {
      if (key === detailKey) {
        this.detail[index] = [key, value];
      }
    });
  }

  /**
   * Is exist the key in created header??
   * @param key
   * @returns
   */
  public exist(key: keyof UserScriptHeaderProps) {
    this.detail.forEach(([detailKey]) => {
      if (key === detailKey) {
        return true;
      }
    });
    return false;
  }
}
