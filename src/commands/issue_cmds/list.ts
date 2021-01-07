import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';
import * as su from '../../select_user';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0', 'l'];
exports.desc = 'List issues';
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
  let jql = '';
  if (argv.assignee) {
    const selectOptions: su.ISelectUserOptions = {
      required: true,
      alwaysConfirm: false,
    };
    const accountId = await su.selectUser(jira, argv.assignee, selectOptions);
    jql += `assignee IN (${accountId})`;
  } else {
    jql += 'assignee = currentUser()';
  }

  if (argv.project) {
    jql += ` AND project = "${argv.project}"`;
  }
  if (argv.status) {
    jql += ` AND status = "${argv.status}"`;
  }
  jql += ' ORDER BY created DESC';
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
    terminal(`^g${n[0]}^: ^y"${n[1]}"^: ${n[2]}\n`);
  }

  process.exit();
};
