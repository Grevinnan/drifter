import yargs from 'yargs';
import getBitBucket from '../../bb_cloud';
import * as ft from '../../format';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0'];
exports.desc = 'List repositories';
exports.builder = (yargs: yargs.Argv<{}>) => {};

exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  let workspaceIds = (await bb.getWorkspaces()).map((ws) => ws.uuid);
  for (let uuid of workspaceIds) {
    let repositories = await bb.getRepositories(uuid);
    repositories.forEach((repo) => terminal(ft.formatRepository(repo)));
  }
  process.exit();
};
