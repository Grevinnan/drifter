import getBitBucket, * as bbc from '../../bb_cloud';
import * as ft from '../../format';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'list';
exports.aliases = ['$0'];
exports.desc = 'Lists pullrequests';
exports.builder = {};
exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  let user = await bb.getUser();
  let pullrequests = await bb.getPullrequests(user.uuid);
  pullrequests.forEach(pr => terminal(ft.formatPullrequest(pr)));
  // console.log(pullrequests);
  // console.log(pullrequests[0].source);
  // console.log(pullrequests[0].destination);
  // workspaces.forEach((workspace) => terminal(`${workspace.slug} ${workspace.uuid}\n`));
  process.exit();
};

