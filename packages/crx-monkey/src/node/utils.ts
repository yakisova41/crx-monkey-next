import chalk from 'chalk';
import { container } from './inversify.config';
import { Logger } from './Logger';
import { TYPES } from './types';

/**
 * Nice visibility stack trace.
 * @param e
 */
export function errorHandler(e: Error) {
  const logger = container.get<Logger>(TYPES.Logger); /*
  dispatchErr(`${chalk.bgRed(` CRXM ${e.name} `)} ${chalk.bold(e.message)}`);

  const stack = e.stack?.split('\n');
  stack?.shift();
  console.error(stack?.map((l) => chalk.gray(l)).join('\n'));*/

  const msg = `❌ ${chalk.bold(e.name + ':')} ${chalk.bold(e.message)}`;

  const stack = e.stack?.split('\n');
  stack?.shift();
  const stackStr = stack?.map((l) => chalk.gray(l)).join('\n');

  logger.dispatchErr(msg, stackStr);
}

/**
 * Stringify a function that binded args.
 * @param target function
 * @param args args
 * @returns A function stringified.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stringifyFunction<V extends (...args: any[]) => any>(
  target: V,
  args: Parameters<V>,
): string {
  const raw = target.toString();

  const newArgs = args.map((arg) => {
    if (typeof arg === 'string') {
      return `'${arg}'`;
    } else {
      return String(arg);
    }
  });

  const code = `(${raw})(${newArgs.join(', ')});`;
  return code;
}
