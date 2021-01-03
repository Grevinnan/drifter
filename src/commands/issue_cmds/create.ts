import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';
import * as su from '../../select_user';
import * as dn from '../../description';

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
    })
    .option('s', {
      alias: 'summary',
      type: 'string',
      description: 'Issue summary',
      default: null,
    })
    .option('d', {
      alias: 'description',
      type: 'string',
      description: 'Issue description',
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
  // console.log(users);
  // process.exit(0);
  const project = createMeta.projects[0];
  const issueTypes = project.issuetypes;
  const issueTypeNames = issueTypes.map((x: any) => x.name);
  // console.log(issueTypeNames);
  let issueType = await terminal.singleRowMenu(issueTypeNames, {}).promise;
  terminal('\n');
  terminal(`${issueType.selectedText}\n`);
  let summary = argv.summary;
  if (!summary) {
    terminal('Enter summary: ');
    summary = await terminal.inputField({}).promise;
    terminal('\n');
  }
  let description = argv.description;
  if (!description) {
    terminal('Enter description: ');
    summary = await terminal.inputField({}).promise;
    terminal('\n');
  }
  let createObj = {
    fields: {},
    update: {},
  };
  const fields = createObj.fields;
  fields['summary'] = summary;
  fields['description'] = dn.createParagraph(description);
  fields['issuetype'] = {
    id: issueTypes[issueType.selectedIndex].id,
  };
  fields['project'] = {
    id: projectInfo.id,
  };
  if (argv.assignee) {
    const selectOptions: su.ISelectUserOptions = {
      required: true,
      alwaysConfirm: true,
    };
    const accountId = await su.selectUser(jira, argv.assignee, selectOptions);
    fields['assignee'] = {
      id: accountId,
    };
  }

  // console.log(fields);
  // process.exit(0);
  let createResult = await jira.createIssue(createObj);
  // console.log(createResult);
  if (createResult) {
    terminal(`Created issue ${createResult.key}\n`);
    terminal(`${jira.getIssueURL(createResult.key)}\n`);
  } else {
    terminal.error.red('Could not create issue\n');
    process.exit(1);
  }
  process.exit();
};
