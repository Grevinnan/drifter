import * as jirac from './jira_cloud';
import * as tu from './terminal_util';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export interface ISelectUserOptions {
  required: boolean;
  alwaysConfirm: boolean;
}

export async function selectUser(
  jira: jirac.Jira,
  query: string,
  options: ISelectUserOptions
) {
  const users = await jira.searchUsersByQuery(query);
  if (users === null) {
    terminal.error(`Could not search users with query ^r"${query}"^:\n`);
    process.exit(1);
  }
  if (options.required && users.length == 0) {
    terminal.error(`No users found with query ^r"${query}"^:, aborting.\n`);
    process.exit(1);
  }
  let userIndex = 0;
  if (users.length > 1) {
    let userNames = users.map((x: any) => x.displayName);
    terminal('Multiple matches, Please select user:\n');
    let user = await terminal.singleRowMenu(userNames, {}).promise;
    terminal('\n\n');
    userIndex = user.selectedIndex;
  } else if (options.alwaysConfirm) {
    terminal(`Confirm user ^g"${users[userIndex].displayName}"^:? [y/n]\n`);
    let proceed = await terminal.yesOrNo(tu.yesOrNoKeyMaps).promise;
    if (!proceed) {
      if (options.required) {
        terminal.error('Did not select user, aborting.\n');
        process.exit(1);
      }
      return null;
    }
  }
  terminal(`Selected user: ^g${users[userIndex].displayName}^:\n`);
  let accountId = users[userIndex].accountId;
  return accountId;
}
