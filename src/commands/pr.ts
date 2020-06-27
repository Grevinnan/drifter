import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'pr';
exports.aliases = ['pullrequest'];
exports.desc = 'Operations on pullrequests';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('pr_cmds', commandDirOptions());
};
exports.handler = (argv: any) => {}
