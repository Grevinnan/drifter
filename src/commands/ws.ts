import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'ws';
exports.aliases = ['workspace'];
exports.desc = 'Operations on workspaces';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('ws_cmds', commandDirOptions());
};
exports.handler = (argv: any) => {}
