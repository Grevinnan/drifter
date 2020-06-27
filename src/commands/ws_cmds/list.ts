import getBitBucket from '../../bb_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0'];
exports.desc = 'Lists workspaces';
exports.builder = {};
exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  let workspaces = await bb.getWorkspaces();
  workspaces.forEach((workspace) => terminal(`${workspace.slug} ${workspace.uuid}\n`));
  process.exit();
};
