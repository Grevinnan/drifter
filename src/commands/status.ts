import yargs from 'yargs';
import getJira, * as jirac from '../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 's';
exports.aliases = ['$0', 'status'];
exports.desc = 'Shows current status';
exports.builder = (yargs: yargs.Argv<{}>) => {
  // return yargs.commandDir('user_cmds', commandDirOptions());
};
exports.handler = async (argv: any) => {

  let jira = await getJira(argv);
  let parameters = new Map<String, String>();
  let assignee = 'currentUser()';
  let jql = `assignee = ${assignee}`;
  // jql = jql + ` AND status NOT IN (done,closed,"awaiting release",resolved,backlog)`;
  jql = jql + ` AND status IN ("in progress","selected for development")`;
  jql = jql + ' ORDER BY created DESC';
  parameters.set('jql', jql);
  const maxEntries = 0;
  parameters.set('maxResults', maxEntries.toString());
  let issues = await jira.searchIssues(parameters, maxEntries);
  if (!issues) {
    terminal.error.red('Could not get issues\n');
    process.exit(1);
  }
  // console.log(issues);
  let issueSummary = issues.map((x) => [x.key, x.fields.status.name, x.fields.summary]);
  for (let n of issueSummary) {
    terminal(`${n[0]} "${n[1]}" ${n[2]}\n`);
  }

  process.exit();
}
