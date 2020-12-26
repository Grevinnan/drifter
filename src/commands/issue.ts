import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'i';
exports.aliases = ['issue'];
exports.desc = 'Operations on issues';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('issue_cmds', commandDirOptions());
};
exports.handler = (argv: any) => {}
