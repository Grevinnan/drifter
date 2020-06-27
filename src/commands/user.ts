import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'user';
exports.aliases = [];
exports.desc = 'Operations on user';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('user_cmds', commandDirOptions());
};
exports.handler = (argv: any) => {}
