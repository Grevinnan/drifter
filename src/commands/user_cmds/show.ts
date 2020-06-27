import yargs from 'yargs';
import getBitBucket, * as bbc from '../../bb_cloud';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'show';
exports.aliases = ['$0'];
exports.desc = 'Show user info';
exports.builder = (yargs: yargs.Argv<{}>) => {};

exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  let user = await bb.getUser();
  terminal(`${user.username} ${user.nickname} ${user.created_on}\n`);
  process.exit();
};

