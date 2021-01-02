import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'search <query>';
exports.aliases = ['e'];
exports.desc = 'Search users';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs.positional('query', {
    describe: 'Search query',
    type: 'string',
    default: '',
  });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  const users = await jira.searchUsersByQuery(argv.query);
  const userData = users.map((x: any) => [x.displayName, x.emailAddress]);
  // console.log(userData);
  for (let u of userData) {
    terminal(`^g${u[0]}^: ^b${u[1]}^:\n`);
  }
  process.exit();
};
