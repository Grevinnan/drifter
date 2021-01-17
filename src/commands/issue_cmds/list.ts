import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';
import * as su from '../../select_user';
import * as ju from '../../jql';

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
      requiresArg: true,
    })
    .option('p', {
      alias: 'project',
      type: 'string',
      description: 'Project',
      requiresArg: true,
    })
    .option('t', {
      alias: 'status',
      type: 'string',
      description: 'Issue status',
      requiresArg: true,
    })
    .option('m', {
      alias: 'max_entries',
      type: 'number',
      description: 'Maximum number of issues',
      default: 20,
      requiresArg: true,
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
    let assignees = argv.assignee.split(',');
    let ids = [];
    for (let a of assignees) {
      const accountId = await su.selectUser(jira, a, selectOptions);
      ids.push(accountId);
    }
    const allIds = ids.join(',');
    jql = ju.concatJql(jql, `assignee IN (${allIds})`);
  }

  if (argv.project) {
    jql = ju.concatJql(jql, `project IN (${argv.project})`);
  }
  if (argv.status) {
    // Surround statuses with quotes to allow states with spaces in them
    let statuses = argv.status
      .split(',')
      .map((x: string) => `"${x}"`)
      .join(',');
    jql = ju.concatJql(jql, `status IN (${statuses})`);
  }
  jql += ' ORDER BY created DESC';
  parameters.set('jql', jql);
  parameters.set('maxResults', argv.max_entries);
  let issues = await jira.searchIssues(parameters, argv.max_entries);
  if (!issues) {
    terminal.error.red('Could not get issues\n');
    process.exit(1);
  }

  let issueSummary = issues.map((x) => [
    x.key,
    x.fields.status.name,
    x.fields.summary,
    x.fields.assignee,
  ]);
  for (let n of issueSummary) {
    terminal(`^g${n[0]}^: ^y"${n[1]}"^: ${n[2]} `);
    if (n[3]) {
      terminal(`^b${n[3].displayName}^:`);
    }
    terminal('\n');
  }

  process.exit();
};
