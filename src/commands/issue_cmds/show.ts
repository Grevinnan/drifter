import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'show <issue>';
exports.desc = 'Show issue info';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs.positional('issue', {
    describe: 'Issue key/ID',
    type: 'string',
    default: '',
  });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  let issue = await jira.getIssue(argv.issue);
  if (!issue) {
    terminal.error.red(`Could not find issue ${argv.issue}\n`);
    process.exit(1);
  }
  // console.log(issue);
  const key = issue.key;
  const fields = issue.fields;
  const type = fields.issuetype.name;
  const status = fields.status.name;
  const assignee = fields.assignee;
  const creator = fields.creator;
  const reporter = fields.reporter;
  let assigneeName = 'Unassigned';
  if (assignee) {
    assigneeName = assignee.displayName;
  }
  let creatorName = null;
  if (creator) {
    creatorName = creator.displayName;
  }
  let reporterName = null;
  if (reporter) {
    reporterName = reporter.displayName;
  }
  const summary = fields.summary;
  const description = fields.description;
  // console.log(description.content);
  const fullDescription = description.content
    .map((x: any) => x.content.map((x: any) => x.text).join('\n'))
    .join('\n');
  terminal(`Key: ${key}\n`);
  terminal(`Summary: ${summary}\n`);
  terminal(`Type: ${type}\n`);
  terminal(`Status: ${status}\n`);
  terminal(`Assignee: ${assigneeName}\n`);
  if (creatorName) {
    terminal(`Creator: ${creatorName}\n`);
  }
  if (reporterName) {
    terminal(`Reporter: ${reporterName}\n`);
  }
  terminal(`Description: ${fullDescription}\n`);
  process.exit();
};
