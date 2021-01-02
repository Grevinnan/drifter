import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'edit <issue>';
exports.aliases = ['e'];
exports.desc = 'Edit issue';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('issue', {
      describe: 'Issue key/ID',
      type: 'string',
      default: '',
    })
    .option('a', {
      alias: 'assignee',
      type: 'string',
      description: 'Assignee',
      default: null,
    })
    .option('s', {
      alias: 'summary',
      type: 'string',
      description: 'Issue summary',
      default: null,
    });
};

async function selectUser(jira: jirac.Jira, query: string, required: boolean = true) {
  const users = await jira.searchUsersByQuery(query);
  if (users === null) {
    terminal.error(`Could not search users with query ^r"${query}"^:\n`);
    process.exit(1);
  }
  if (required && users.length == 0) {
    terminal.error(`No users found with query ^r"${query}"^:, aborting.\n`);
    process.exit(1);
  }
  let accountId = users[0].accountId;
  if (users.length > 1) {
    let userNames = users.map((x: any) => x.displayName);
    terminal('Multiple matches, Please select user:\n');
    let user = await terminal.singleRowMenu(userNames, {}).promise;
    terminal('\n\n');
    terminal(`Selected user: ^g${user.selectedText}^:\n`);
    accountId = users[user.selectedIndex].accountId;
  }
  return accountId;
}

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);

  let editData = {
    update: {},
    fields: {},
  };
  if (argv.assignee) {
    const accountId = await selectUser(jira, argv.assignee);
    editData.fields['assignee'] = { id: accountId };
  }

  if (argv.summary) {
    editData.fields['summary'] = argv.summary;
  }

  const editResult = await jira.editIssue(argv.issue, editData);
  console.log(editResult);
  process.exit();
};
