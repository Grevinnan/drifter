import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'project';
exports.aliases = [];
exports.desc = 'Operations on projects';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('project_cmds', commandDirOptions());
};
exports.handler = (argv: any) => {}
