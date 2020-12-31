import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'create <project>';
exports.aliases = ['s'];
exports.desc = 'Show issue info';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs.positional('project', {
    describe: 'Project key/ID',
    type: 'string',
    default: '',
  });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  process.exit();
};
