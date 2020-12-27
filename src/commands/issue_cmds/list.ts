import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.desc = 'List projects';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .option('a', {
      alias: 'assignee',
      type: 'string',
      description: 'Assignee',
      default: null,
    })
    .option('p', {
      alias: 'project',
      type: 'string',
      description: 'Project',
      default: null,
    })
    .option('t', {
      alias: 'status',
      type: 'string',
      description: 'Status',
      default: null,
    })
    .option('m', {
      alias: 'max_entries',
      type: 'number',
      description: 'Maximum number of issues',
      default: 20,
    });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  let parameters = new Map<String, String>();
  let assignee = 'currentUser()';
  if (argv.assignee) {
    assignee = argv.assignee;
  }
  let jql = `assignee = ${assignee}`;
  if (argv.project) {
    jql = jql + ` AND project = "${argv.project}"`;
  }
  if (argv.status) {
    jql = jql + ` AND status = "${argv.status}"`;
  }
  jql = jql + ' ORDER BY created DESC';
  parameters.set('jql', jql);
  parameters.set('maxResults', argv.max_entries);
  let issues = await jira.searchIssues(parameters, argv.max_entries);
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
};
