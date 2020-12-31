#!/usr/bin/env node

'use strict';

import yargs from 'yargs';
import commandDirOptions from './command_dir';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

terminal.on('key', (key: string) => {
  if (key === 'CTRL_C' || key === 'CTRL_D' || key === 'q') {
    terminal('\n');
    terminal.grabInput(false);
    terminal.fullscreen(false);
    terminal.applicationKeypad(false);
    terminal.hideCursor(false);
    process.exit();
  }
});

const base = yargs
  .scriptName('drifter')
  .version('v0.0.1')
  .usage('drifter - The friendly JIRA CLI')
  .alias('h', 'help')
  .strict(true)
  .demandCommand()
  .option('v', {
    alias: 'verbose',
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .option('f', {
    alias: 'force-synchronization',
    type: 'boolean',
    description: 'Will force synchronization with the server',
    default: false,
  });
base.commandDir('./commands', commandDirOptions());
yargs.argv;
