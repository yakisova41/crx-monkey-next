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
