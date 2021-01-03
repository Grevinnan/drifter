import yargs from 'yargs';
import getJira, * as jirac from '../jira_cloud';
import _ from 'lodash';
import * as su from '../select_user';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 's';
exports.aliases = ['status'];
exports.desc = 'Shows current status';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .option('a', {
      alias: 'assignee',
      type: 'string',
      description: 'Assignee',
      default: null,
    })
    .option('m', {
      alias: 'max_entries',
      type: 'number',
      description: 'Maximum number of issues',
      default: 0,
    });
};

const key = (x: any) => x.key;
const status = (x: any) => x.fields.status.name;
const summary = (x: any) => x.fields.summary;

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  let parameters = new Map<String, String>();
  let assignee = 'currentUser()';
  if (argv.assignee) {
    const selectOptions: su.ISelectUserOptions = {
      required: true,
      alwaysConfirm: false,
    };
    assignee = await su.selectUser(jira, argv.assignee, selectOptions);
  }
  let jql = `assignee = "${assignee}"`;
  // jql = jql + ` AND status NOT IN (done,closed,"awaiting release",resolved,backlog)`;
  jql = jql + ` AND status IN ("in progress","selected for development")`;
  jql = jql + ' ORDER BY created DESC';
  parameters.set('jql', jql);
  if (argv.max_entries > 0) {
    parameters.set('maxResults', argv.max_entries);
  }
  let issues = await jira.searchIssues(parameters, argv.max_entries);
  if (!issues) {
    terminal.error.red('Could not get issues\n');
    process.exit(1);
  }
  let statuses = _.uniq(issues.map(status).map((x) => x.toLowerCase()));
  for (let s of statuses) {
    // console.log(s);
    terminal.blue(`${s}\n`);
    let statusIssues = _.filter(issues, (i: any) => status(i).toLowerCase() === s);
    let issueData = statusIssues.map((x) => [key(x), summary(x)]);
    for (let n of issueData) {
      terminal(`^g${n[0]}^: ${n[1]}\n`);
    }
    terminal('\n');
  }

  process.exit();
};
