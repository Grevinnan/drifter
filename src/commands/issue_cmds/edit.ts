import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';
import * as su from '../../select_user';
import * as dn from '../../description';

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

  let editData = {
    update: {},
    fields: {},
  };
  if (argv.assignee) {
    const selectOptions: su.ISelectUserOptions = {
      required: true,
      alwaysConfirm: true,
    };
    const accountId = await su.selectUser(jira, argv.assignee, selectOptions);
    editData.fields['assignee'] = { id: accountId };
  }

  if (argv.summary) {
    editData.fields['summary'] = argv.summary;
  }

  if (argv.description) {
    editData.fields['description'] = dn.createParagraph(argv.description);
  }

  const numFields = Object.keys(editData.fields);
  if (!numFields.length) {
    terminal('No fields edited, aborting.\n');
    process.exit();
  }

  if (argv['dry-run']) {
    terminal(`${JSON.stringify(editData, null, 2)}\n`);
    process.exit();
  }

  const editResult = await jira.editIssue(argv.issue, editData);
  if (editResult === 204) {
    terminal(`Issue ^g"${argv.issue}"^: updated\n`);
  } else {
    terminal.error(`Could not update issue, got code ^r${editResult}^:\n`);
  }
  process.exit();
};
