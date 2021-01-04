import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';
import _ from 'lodash';
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
    .option('t', {
      alias: 'type',
      type: 'string',
      description: 'Type of issue',
      default: null,
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
    })
    .option('n', {
      alias: 'dry-run',
      type: 'boolean',
      description: 'Will not create an issue, only print the creation object',
      default: false,
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
    terminal.error(`Could not get project data for project ^r"${argv.project}"^:\n`);
    process.exit(1);
  }
  // console.log(createMeta);
  // console.log(projectInfo);
  // process.exit(0);
  const project = createMeta.projects[0];
  const issueTypes = project.issuetypes;
  const issueTypeNames = issueTypes.map((x: any) => x.name);
  // console.log(issueTypeNames);
  let issueTypeIndex = -1;
  if (argv.type) {
    let taskType = argv.type.toLowerCase();
    let selectedType = _.findIndex(
      issueTypeNames,
      (x: string) => x.toLowerCase() === taskType
    );
    if (selectedType < 0) {
      terminal.error(`No match for issue type ^r"${taskType}"^:, available types are:\n`);
      terminal.error(`${issueTypeNames.join(',')}\n`);
      process.exit(1);
    }
    issueTypeIndex = selectedType;
  } else {
    terminal('Please select issue-type:\n');
    let issueType = await terminal.singleRowMenu(issueTypeNames, {}).promise;
    terminal('\n');
    issueTypeIndex = issueType.selectedIndex;
  }
  let summary = argv.summary;
  if (!summary) {
    terminal('Enter summary: ');
    summary = await terminal.inputField({}).promise;
    terminal('\n');
  }
  let description = argv.description;
  if (!description) {
    terminal('Enter description: ');
    description = await terminal.inputField({}).promise;
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
    id: issueTypes[issueTypeIndex].id,
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

  if (argv['dry-run']) {
    terminal(`${JSON.stringify(createObj, null, 2)}\n`);
    process.exit();
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
