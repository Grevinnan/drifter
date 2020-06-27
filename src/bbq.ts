#!/usr/bin/env node

'use strict';

import yargs from 'yargs';
import commandDirOptions from './command_dir';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

terminal.on('key', (key: string) => {
  if (key === 'CTRL_C' || key === 'CTRL_D') {
    terminal.grabInput(false);
    process.exit();
  }
});

const base = yargs
  .scriptName('bbq')
  .version('v0.0.1')
  .alias('h', 'help')
  .strict(true)
  .demandCommand()
  .option('v', {
    alias: 'verbose',
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .option('m', {
    alias: ['max-pages'],
    type: 'number',
    description: 'The maximum number of pages to fetch',
    default: 10,
  })
  .option('s', {
    alias: 'force-synchronization',
    type: 'boolean',
    description: 'Will force synchronization with the server',
    default: false,
  });
base.commandDir('./commands', commandDirOptions());
yargs.argv;
