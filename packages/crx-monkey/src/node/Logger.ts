import chalk from 'chalk';
import { inject, injectable } from 'inversify';
import moment from 'moment';
import { TYPES } from './types';
import { ConfigLoader } from './ConfigLoader';
import packageJ from '../../package.json';
import { dirname, resolve } from 'path';

@injectable()
export class Logger {
  public logLevel: 'info' | 'error' | 'debug' = 'info';

  constructor(@inject(TYPES.ConfigLoader) private readonly configLoader: ConfigLoader) {}

  public showInfo() {
    const {
      server: { host, port, websocket },
      output: { chrome },
      manifest,
    } = this.configLoader.useConfig();

    if (chrome === undefined) {
      throw new Error('');
    }

    const chromePathAbsolute = resolve(dirname(manifest), chrome);

    console.log(`\n  ${chalk.cyanBright('CRX MONEKY')} v${packageJ.version}`);
    console.log(
      `\n  You can install development userscript:\n    ${chalk.greenBright(`http://${host}:${port}/dev.user.js`)}`,
    );
    console.log(
      `\n  You can install development chrome extension:\n    ${chalk.greenBright(chromePathAbsolute)}`,
    );
    console.log(
      `\n  Websocket running on:\n    ${chalk.greenBright(`http://${host}:${websocket}`)}`,
    );
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
