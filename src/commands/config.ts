import yargs from 'yargs';
import * as bbc from '../bb_cloud';

exports.command = 'cg';
exports.aliases = ['config'];
exports.desc = 'Handle your configuration';
exports.builder = {
  c: {
    alias: 'clear',
    type: 'boolean',
    description: 'Clear your configuration',
    default: false,
  },
};
exports.handler = async (argv: any) => {
  let config = await bbc.getConfig();
  if (argv.clear) {
    await config.clearConfig();
  } else {
    yargs.showHelp();
  }
  process.exit();
};
