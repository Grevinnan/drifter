import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'u';
exports.aliases = ['user'];
exports.desc = 'Operations on users';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('user_cmds', commandDirOptions());
};
exports.handler = (argv: any) => {}
