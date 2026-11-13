import chalk from 'chalk';
import { injectable } from 'inversify';
import moment from 'moment';
import packageJ from '../../package.json';
import { dirname, resolve } from 'path';
import { absoluteGuard } from './file';
import { CrxmConfigRequired } from './typeDefs';

@injectable()
export class Logger implements I_Logger {
  public logLevel: 'info' | 'error' | 'debug' = 'info';

  public showInfo(config: CrxmConfigRequired) {
    const {
      server: { host, port, websocket },
      output: { chrome },
      manifest,
    } = config;

    if (chrome === undefined) {
      throw new Error('');
    }

    const chromePathAbsolute = absoluteGuard(resolve(dirname(manifest), chrome));

    console.log(`\n  ${chalk.cyanBright('CRX MONEKY')} v${packageJ.version}`);
    console.log(
      `\n  You can install development userscript:\n    ${chalk.greenBright(`http://${host}:${port}/dev.user.js`)}`,
    );
    console.log(
      `\n  You can install development chrome extension:\n    ${chalk.greenBright(chromePathAbsolute)}`,
    );
    console.log(`\n  Websocket running on:\n    ${chalk.greenBright(`ws://${host}:${websocket}`)}`);
    console.log('');
  }

  public initialize() {
    console.clear();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public dispatchLog(...detail: any) {
    if (this.logLevel === 'debug' || this.logLevel === 'error' || this.logLevel === 'info') {
      console.log(...[`[${this.getDateNowFormated()}] ${chalk.bgGreen(' LOG ')} `, ...detail]);
    }
    return detail.join('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public dispatchErr(...detail: any) {
    if (this.logLevel === 'debug' || this.logLevel === 'error') {
      console.log(...[`[${this.getDateNowFormated()}] ${chalk.bgRed(' ERROR ')}`, ...detail]);
      console.log(this.getStack());
    }
    return detail.join('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public dispatchDebug(...detail: any) {
    if (this.logLevel === 'debug') {
      console.log(...[`[${this.getDateNowFormated()}] ${chalk.bgCyan(' DEBUG ')}`, ...detail]);
    }
    return detail.join('\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public dispatchDebugStack(...detail: any) {
    if (this.logLevel === 'debug') {
      console.log(...[`[${this.getDateNowFormated()}] ${chalk.bgCyan(' DEBUG ')}`, ...detail]);
      console.log(this.getStack());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public dispatchConsole(...detail: any) {
    if (this.logLevel === 'debug' || this.logLevel === 'error' || this.logLevel === 'info') {
      console.log(...[`[${this.getDateNowFormated()}] ${chalk.bgYellow(' CONSOLE ')}`, ...detail]);
    }
  }

  private getDateNowFormated() {
    const formattedDate = moment().format('YYYY/MM/DD HH:mm:ss');
    return formattedDate;
  }

  private getStack() {
    const error = new Error();
    const stack = error.stack?.split('\n');

    if (stack !== undefined) {
      const str = stack
        .slice(3)
        .map((x) => chalk.gray(x))
        .join('\n');
      return str;
    } else {
      return 'Could not get stack trace.';
    }
  }
}

export interface I_Logger {
  logLevel: 'info' | 'error' | 'debug';
  showInfo(config: CrxmConfigRequired): void;
  initialize(): void;
  dispatchLog(...detail: unknown[]): string;
  dispatchErr(...detail: unknown[]): string;
  dispatchDebug(...detail: unknown[]): string;
  dispatchDebugStack(...detail: unknown[]): void;
  dispatchConsole(...detail: unknown[]): void;
}
