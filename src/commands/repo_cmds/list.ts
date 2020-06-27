import yargs from 'yargs';
import getBitBucket from '@app/bb_cloud';
import * as ft from '@app/format';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0'];
exports.desc = 'List repositories';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs.option('p', {
    alias: 'public',
    type: 'boolean',
    description: 'List public repositories',
    default: false,
  });
};

exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  if (argv.public) {
    let repositories = await bb.getPublicRepositories();
    repositories.forEach((repo) => terminal(ft.formatRepository(repo)));
  } else {
    let workspaceIds = (await bb.getWorkspaces()).map((ws) => ws.uuid);
    for (let uuid of workspaceIds) {
      let repositories = await bb.getRepositories(uuid);
      repositories.forEach((repo) => terminal(ft.formatRepository(repo)));
    }
  }
  process.exit();
};
