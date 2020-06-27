import yargs from 'yargs';
import getBitBucket from '../../bb_cloud';
import * as ft from '../../format';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'show <workspace>';
exports.aliases = [];
exports.desc = 'Shows workspace info';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs.positional('workspace', {
    describe: 'Workspace name/uuid',
    type: 'string',
    default: '',
  });
};
exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  let workspaceId: string = argv.workspace;
  let workspace = await bb.findWorkspace(workspaceId);
  if (!workspace) {
    terminal.error.red(`Could not find workspace "${workspaceId}"\n`);
    process.exit();
  }
  let members = await bb.getMembers(workspace.uuid);
  terminal(ft.formatWorkspace(workspace));
  terminal('Members:\n');
  members.forEach((member) => terminal(ft.formatMember(member)));
  process.exit();
};
