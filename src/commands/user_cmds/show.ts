import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'show';
exports.aliases = ['$0'];
exports.desc = 'Show user info';
exports.builder = (yargs: yargs.Argv<{}>) => {};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  let user = await jira.getUser();
  // console.log(user);
  terminal(`${user.accountId} ${user.displayName}\n`);
  process.exit();
};

