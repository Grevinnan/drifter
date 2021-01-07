import yargs from 'yargs';
import getJira, * as jirac from '../../jira_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0'];
exports.desc = 'List projects';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
      .option('q', {
        alias: 'query',
        type: 'string',
        description: 'Project query',
        requiresArg: true,
      });
};

exports.handler = async (argv: any) => {
  let jira = await getJira(argv);
  let parameters = new Map<String, String>();
  // parameters.set('expand', 'description,lead');
  if (argv.query) {
    parameters.set('query', argv.query);
  }
  let projects = await jira.searchProjects(parameters);
  // console.log(projects);
  if (!projects) {
    terminal.error.red('Could not get projects\n');
    process.exit(1);
  }
  let names = projects.map(x => [x.key, x.name]);
  for (let n of names) {
    terminal(`${n[0]} ${n[1]}\n`);
  }
  // console.log(names);

  process.exit();
};
