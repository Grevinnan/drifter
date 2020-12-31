import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';
import * as tu from '../../terminal_util';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'create <project>';
exports.aliases = ['c'];
exports.desc = 'Creates a new issue';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('project', {
      describe: 'Project key',
      type: 'string',
      default: '',
    })
    .option('a', {
      alias: 'assignee',
      type: 'string',
      description: 'Assignee',
      default: null,
    });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  let createParameters = new Map<String, String>();
  createParameters.set('projectKeys', argv.project);
  let createMeta = await jira.getCreateMeta(createParameters);
  if (!createMeta) {
    terminal.error.red(`Could not get createmeta for project ${argv.project}\n`);
    process.exit(1);
  }
  const projectInfo = await jira.getProject(argv.project);
  if (!projectInfo) {
    terminal.error.red(`Could not get project data for ${argv.project}\n`);
    process.exit(1);
  }
  // console.log(createMeta);
  // console.log(projectInfo);
  let params = new Map<String, String>();
  params.set('query', argv.assignee);
  const users = await jira.searchUsers(params);
  // console.log(users);
  // process.exit(0);
  const project = createMeta.projects[0];
  const issueTypes = project.issuetypes;
  const issueTypeNames = issueTypes.map((x: any) => x.name);
  // console.log(issueTypeNames);
  let issueType = await terminal.singleRowMenu(issueTypeNames, {}).promise;
  terminal('\n');
  terminal(`${issueType.selectedText}\n`);
  terminal('Summary: ');
  let summary = await terminal.inputField({}).promise;
  terminal('\n');
  let createObj = {
    fields: {},
    update: {},
  };
  const fields = createObj.fields;
  fields['summary'] = summary;
  fields['issuetype'] = {
    id: issueTypes[issueType.selectedIndex].id,
  };
  fields['project'] = {
    id: projectInfo.id,
  };
  // TODO: use edit-issue to assign instead
  // if (argv.assignee) {
  //   fields['assignee'] = {
  //     // id: users[0].accountId,
  //     name: 'Henrik Antonsson',
  //   };
  // }
  console.log(fields);
  let createResult = await jira.createIssue(createObj);
  console.log(createResult);
  process.exit();
};
