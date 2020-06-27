import fsize from 'filesize';
import Cache from '../cache';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'cc';
exports.aliases = ['cache'];
exports.desc = 'Handle your cache';
exports.builder = {
  c: {
    alias: 'clear',
    type: 'boolean',
    description: 'Clear your cache',
    default: false,
  },
};
exports.handler = async (argv: any) => {
  let cache = new Cache({}, argv.v);
  if (argv.clear) {
    await cache.clear();
  } else {
    terminal(`Directory: ${cache.cacheDirectory}\n`);
    terminal(`Size: ${fsize(cache.getCacheSize())}\n`);
  }
  process.exit();
};
