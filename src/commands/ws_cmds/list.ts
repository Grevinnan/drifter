import getBitBucket from '../../bb_cloud';
import * as ft from '../../format';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0'];
exports.desc = 'Lists workspaces';
exports.builder = {};
exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  let workspaces = await bb.getWorkspaces();
  workspaces.forEach((workspace) => terminal(ft.formatWorkspace(workspace)));
  process.exit();
};
