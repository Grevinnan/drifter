import yargs from 'yargs';
import getBitBucket from '../bb_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'ws';
exports.aliases = ['workspace'];
exports.desc = 'Operations on workspaces';
exports.builder = {
  l: {
    alias: 'list',
    type: 'boolean',
    description: 'List available workspaces',
    default: false,
  },
};
exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  if (argv.l) {
    let workspaces = await bb.getWorkspaces();
    workspaces.forEach((workspace) => terminal(`${workspace.slug} ${workspace.uuid}\n`));
  } else {
    yargs.showHelp();
  }
  process.exit();
};
