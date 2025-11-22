/**
 * The main endpoint for node of crx-monkey.
 * Scripts in this file are used from console.
 */

import cac from 'cac';
import sourceMapSupport from 'source-map-support';
import packageJson from '../../package.json';
import { dev } from './dev';
import { build } from './build';

// For stacktrace.
sourceMapSupport.install();

// Register cli
const cli = cac('crx monkey');

cli.command('dev', 'Start develop mode.').action(() => {
  dev();
});

cli.command('build', 'Build extension').action(() => {
  build();
});

cli.version(packageJson.version);
cli.help();
cli.parse(process.argv, { run: false });

if (cli.matchedCommand === undefined) {
  cli.outputHelp();
} else {
  await cli.runMatchedCommand();
}
