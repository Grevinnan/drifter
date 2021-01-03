import * as jirac from './jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export async function selectUser(
  jira: jirac.Jira,
  query: string,
  required: boolean = true
) {
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
  } else {
    terminal(`Found user: ^g${users[0].displayName}^:\n`);
  }
  return accountId;
}
