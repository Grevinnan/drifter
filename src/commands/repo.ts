import yargs from 'yargs';
import commandDirOptions from '../command_dir';

exports.command = 'rp';
exports.aliases = ['repository'];
exports.desc = 'Operations on repositories';
exports.builder = function (yargs: yargs.Argv<{}>) {
  return yargs.commandDir('repo_cmds', commandDirOptions());
};
exports.handler = function (_) {};
