import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'edit <issue>';
exports.aliases = ['s'];
exports.desc = 'Edit issue';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs.positional('issue', {
    describe: 'Issue key/ID',
    type: 'string',
    default: '',
  });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  process.exit();
};
