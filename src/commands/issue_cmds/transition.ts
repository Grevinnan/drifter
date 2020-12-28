import _ from 'lodash';
import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'transition <issue> [state]';
exports.aliases = ['t'];
exports.desc = 'Show issue info';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('issue', {
      describe: 'Issue key/ID',
      type: 'string',
      default: '',
    })
    .positional('state', {
      describe: 'Issue state',
      type: 'string',
      default: null,
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

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
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

  let availableTransitions = transitions.transitions.map((x: any) => [
    x.id,
    x.name,
    x.isAvailable,
  ]);
  if (!argv.state) {
    printTransitions(currentStatus, availableTransitions);
  } else {
    let targetState = argv.state.toLowerCase();
    let transition = _.find(
      availableTransitions,
      (x: any) => x[1].toLowerCase() === targetState
    );
    // console.log(transition);
    if (!transition) {
      terminal.error.red(`Could not find transition ${argv.state}\n\n`);
      printTransitions(currentStatus, availableTransitions);
      process.exit(1);
    }
    const transitionObj = {
      transition: {
        id: transition[0],
      },
    };
    const transitionResult = await jira.postTransition(argv.issue, transitionObj)
    if (transitionResult === 204) {
      terminal(`^b${argv.issue}^: set to ^g"${transition[1]}"^:\n`);
      process.exit();
    } else {
      terminal(`Could not set ^b${argv.issue}^: to ^g"${transition[1]}"^:\n`);
      process.exit(1);
    }
  }
};
