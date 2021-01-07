import _ from 'lodash';
import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'transition [issue] [state]';
exports.aliases = ['t'];
exports.desc = 'Show issue info';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('issue', {
      describe: 'Issue key/ID, required if none of the list-options are used',
      type: 'string',
      default: '',
    })
    .positional('state', {
      describe: 'Issue state',
      type: 'string',
      requiresArg: true,
    })
    .option('r', {
      alias: 'resolution',
      type: 'string',
      description: 'Resolution of issue',
      requiresArg: true,
    })
    .option('i', {
      alias: 'interactive',
      type: 'boolean',
      description: 'Select the transition interactively',
      default: false,
    })
    .option('list-resolutions', {
      type: 'boolean',
      description: 'Will list all possible resolutions',
      default: false,
    });
};

function printTransitions(currentStatus: string, availableTransitions: any[]) {
  for (let x of availableTransitions) {
    const status = x[1];
    let color = '';
    if (status === currentStatus) {
      color = '^g';
    }
    terminal(`${color}${status}^:\n`);
  }
}

async function handleResolution(jira: jirac.Jira, argv: any, transition: any) {
  let resolutions = await jira.getResolutions();
  if (!resolutions) {
    terminal.error.red('Could not get resolutions\n');
    process.exit(1);
  }
  let names = resolutions.map((x: any) => x.name);
  const resolutionName = argv.resolution.toLowerCase();
  let resolution = _.find(names, (x) => x.toLowerCase() === resolutionName);
  if (!resolution) {
    terminal.error(`Could not find resolution ^r"${argv.resolution}"^:\n`);
    process.exit(1);
  }
  const fullName = resolution;
  transition.fields['resolution'] = { name: fullName };
}

async function getTransition(
  argv: any,
  availableTransitions: any[],
  currentStatus: string
) {
  let transition = null;
  if (argv.state) {
    let targetState = argv.state.toLowerCase();
    transition = _.find(
      availableTransitions,
      (x: any) => x[1].toLowerCase() === targetState
    );
    if (!transition) {
      terminal.error.red(`Could not find transition ${argv.state}\n\n`);
      printTransitions(currentStatus, availableTransitions);
      process.exit(1);
    }
  } else {
    const transitionNames = availableTransitions.map((x: any) => x[1]);
    terminal(`Current status: ^g"${currentStatus}"^:`);
    let selected = await terminal.singleRowMenu(transitionNames, {}).promise;
    terminal('\n');
    terminal(`Using transition ^g"${selected.selectedText}"^:\n`);
    transition = availableTransitions[selected.selectedIndex];
  }
  return transition;
}

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  if (argv['list-resolutions']) {
    let resolutions = await jira.getResolutions();
    if (!resolutions) {
      terminal.error.red('Could not get resolutions\n');
      process.exit(1);
    }
    let names = resolutions.map((x: any) => x.name);
    for (let n of names) {
      terminal(`^g${n}^:\n`);
    }
    process.exit();
  }

  if (!argv.issue) {
    terminal.error.red('Issue key/ID is required\n');
    process.exit(1);
  }

  let parameters = new Map<String, String>();
  parameters.set('expand', 'transitions');
  let transitions = await jira.getTransitions(argv.issue, parameters);
  if (!transitions) {
    terminal.error.red(`Could not get transitions for issue ${argv.issue}\n`);
    process.exit(1);
  }
  let issue = await jira.getIssue(argv.issue);
  if (!issue) {
    terminal.error.red(`Could not get issue ${argv.issue}\n`);
    process.exit(1);
  }
  let currentStatus = issue.fields.status.name;

  // console.log(transitions);
  // process.exit(0);
  let availableTransitions = transitions.transitions.map((x: any) => [
    x.id,
    x.name,
    x.isAvailable,
  ]);
  if (!argv.state && !argv.interactive) {
    printTransitions(currentStatus, availableTransitions);
  } else {
    let transition = await getTransition(argv, availableTransitions, currentStatus);

    const transitionObj = {
      fields: {},
      transition: {
        id: transition[0],
      },
    };
    if (argv.resolution) {
      await handleResolution(jira, argv, transitionObj);
    }
    // console.log(transitionObj);
    const transitionResult = await jira.postTransition(argv.issue, transitionObj);
    if (transitionResult === 204) {
      terminal(`^b${argv.issue}^: set to ^g"${transition[1]}"^:\n`);
      let fieldKeys = Object.keys(transitionObj.fields);
      for (let key of fieldKeys) {
        terminal(`^b${key}^: = ^g${JSON.stringify(transitionObj.fields[key])}^:\n`);
      }
      process.exit();
    } else {
      terminal(`Could not set ^b${argv.issue}^: to ^g"${transition[1]}"^:\n`);
      process.exit(1);
    }
  }
};
