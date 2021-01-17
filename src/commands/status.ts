import yargs from 'yargs';
import getJira, * as jirac from '../jira_cloud';
import _ from 'lodash';
import { IStatusConfig } from '../config';
import * as su from '../select_user';
import * as ju from '../jql';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 's [name]';
exports.aliases = ['status'];
exports.desc = 'Shows current status';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('name', {
      describe: 'Name of status board',
      type: 'string',
      default: 'default',
    })
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
    })
    .option('c', {
      alias: 'config',
      type: 'boolean',
      description: 'Configure status',
      default: false,
    });
};

// X = in,ex :)
function parseXclude(value: string): string {
  let jql = '';
  if (value === 'include') {
    jql = ' IN ';
  } else {
    jql = ' NOT IN ';
  }
  return jql;
}

// TODO: Put in separate file
function replaceAll(str: string, find: RegExp, replace: string) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function trimSpace(str: string): string {
  str = replaceAll(str, /\s+,\s+/, ',');
  str = replaceAll(str, /\s+/, ' ');
  str = str.trim();
  return str;
}

function sanitizeStatusConfig(config: IStatusConfig) {
  if (config.projects) {
    config.projects = trimSpace(config.projects);
    config.projects = ju.quoteList(trimSpace(config.projects));
  }
  if (config.statuses) {
    config.statuses = trimSpace(config.statuses);
    config.statuses = ju.quoteList(trimSpace(config.statuses));
  }
}

// TODO: remove newlines, spaces, *, help labels?, readme installation, edit config, read config, edit issue
function toJql(config: IStatusConfig) {
  let jql = '';
  if (config.projects) {
    const xclude = parseXclude(config.projectsXclude);
    const projectJql = ` project ${xclude} (${config.projects}) `;
    jql = ju.concatJql(jql, projectJql);
  }
  if (config.statuses) {
    const xclude = parseXclude(config.statusesXclude);
    const statusJql = ` status ${xclude} (${config.statuses}) `;
    jql = ju.concatJql(jql, statusJql);
  }
  jql += ' ORDER BY created DESC';
  jql = trimSpace(jql);
  return jql;
}

const key = (x: any) => x.key;
const status = (x: any) => x.fields.status.name;
const summary = (x: any) => x.fields.summary;

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);

  if (argv.config) {
    terminal.fullscreen(true);
    // @ts-ignore
    let document = terminal.createDocument({});
    // @ts-ignore
    let layout = new tkit.Layout({
      parent: document,
      layout: {
        id: 'main',
        widthPercent: 100,
        rows: [
          {
            id: 'formRow',
            heightPercent: 30,
            columns: [{ id: 'form', widthPercent: 100 }],
          },
          {
            id: 'jqlRow',
            columns: [{ id: 'jql', widthPercent: 100 }],
          },
        ],
      },
    });

    // @ts-ignore
    let form = new tkit.Form({
      parent: document.elements.form,
      // x: 5,
      // y: 3,
      autoWidth: true,
      inputs: [
        {
          key: 'projects',
          label: 'Projects: ',
          content: '',
          height: 4,
          scrollable: true,
          // vScrollBar: true,
        },
        {
          key: 'projectsXclude',
          label: 'Include/exclude projects: ',
          type: 'select',
          value: 'include',
          items: [
            { content: 'include', value: 'include' },
            { content: 'exclude', value: 'exclude' },
          ],
        },
        {
          key: 'statuses',
          label: 'Statuses: ',
          content: '',
          height: 4,
          scrollable: true,
          // vScrollBar: true,
        },
        {
          key: 'statusesXclude',
          label: 'Include/exclude statuses: ',
          type: 'select',
          value: 'include',
          items: [
            { content: 'include', value: 'include' },
            { content: 'exclude', value: 'exclude' },
          ],
        },
      ],
      buttons: [
        {
          content: '<Ok>',
          value: 'ok',
        },
        {
          content: '<Close>',
          value: 'close',
        },
      ],
    });

    // @ts-ignore
    let statusBox = new tkit.TextBox({
      parent: document.elements.jql,
      content: '',
      attr: { bgColor: terminal.bgDefaultColor() },
      autoWidth: true,
      autoHeight: true,
      scrollable: true,
    });

    form.on('submit', onSubmit);

    function onSubmit(value: any) {
      if (value.submit === 'close') {
        // TODO: a terminate function
        terminal.grabInput(false);
        terminal.fullscreen(false);
        terminal.applicationKeypad(false);
        terminal.hideCursor(false);
        process.exit();
      }
      let config: IStatusConfig = value.fields;
      sanitizeStatusConfig(config);
      statusBox.setContent(toJql(config), false);
      jira.getConfig().setStatusConfig(argv.name, config);
    }

    document.giveFocusTo(form);
  } else {
    let statusConfig = jira.getConfig().getStatusConfig(argv.name);
    if (!statusConfig) {
      terminal.error(`No config found for ${argv.name}, run with -c to configure.\n`);
      process.exit(1);
    }
    // if (
    let parameters = new Map<String, String>();
    let assignee = 'currentUser()';
    if (argv.assignee) {
      const selectOptions: su.ISelectUserOptions = {
        required: true,
        alwaysConfirm: false,
      };
      assignee = await su.selectUser(jira, argv.assignee, selectOptions);
    }
    let jql = `assignee = ${assignee}`;
    // jql = jql + ` AND status NOT IN (done,closed,"awaiting
    // release",resolved,backlog)`;
    jql = ju.concatJql(jql, toJql(statusConfig));
    // jql = jql + ` AND status IN ("in progress","selected for development")`;
    // jql = jql + ' ORDER BY created DESC';
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
  }
};
