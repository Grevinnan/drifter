import yargs from 'yargs';
import getBitBucket, * as bbc from '../../bb_cloud';
import * as ft from '../../format';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

exports.command = 'show <repository>';
exports.aliases = [];
exports.desc = 'Show repository data';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('repository', {
      describe: 'Repository name/uuid',
      type: 'string',
      default: '',
    })
    .option('f', {
      alias: 'list-files',
      type: 'boolean',
      description: 'List repository files',
      default: false,
    });
};

class SourceTreeWalker {
  bb: bbc.BitBucket;
  repo: bbc.IRepositoryPath;
  commit: string;
  constructor(bb: bbc.BitBucket, repo: bbc.IRepositoryPath, commit: string) {
    this.bb = bb;
    this.repo = repo;
    this.commit = commit;
  }

  async walkTree(pathParts: string[] = []) {
    let paths = [];
    let sourceFiles = await this.bb.getRepositorySrc(
      this.repo,
      this.commit,
      ...pathParts
    );
    // TODO: consider escaped_path?
    let directoryTasks = [];
    for (let file of sourceFiles) {
      if (file.type === 'commit_file') {
        paths.push(file.path);
      } else {
        // let directoryPaths = await this.walkTree(file.path.split('/'));
        // paths.push(...directoryPaths);
        directoryTasks.push(this.walkTree(file.path.split('/')));
      }
    }
    let directories = await Promise.all(directoryTasks);
    for (let directoryFiles of directories) {
      paths.push(...directoryFiles);
    }
    return paths;
  }
}

async function walkSourceTree(bb: bbc.BitBucket, repo: bbc.IRepositoryPath) {
  let rootFiles = await bb.getRepositorySrc(repo);
  if (rootFiles.length > 0) {
    let commit: string = rootFiles[0].commit.hash;
    // We fetch the same files again but through another endpoint
    let treeWalker = new SourceTreeWalker(bb, repo, commit);
    return await treeWalker.walkTree([]);
  }
  return null;
}

exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  // For some reason TS does not understand the type
  let repoId: string = String(argv.repository);
  let repo = await bb.findRepository(repoId);
  if (!repo) {
    terminal.error.red(`Could not find repository ${argv.repository}\n`);
    process.exit();
  }
  argv.verbose && terminal(`found ${repo.uuid} ${repo.full_name}\n`);
  if (argv.f) {
    let srcFiles = await walkSourceTree(bb, {
      workspace: repo.workspace.uuid,
      repository: repo.uuid,
    });
    srcFiles.forEach((file) => terminal(`${file}\n`));
  } else {
    terminal(ft.formatRepository(repo));
  }
  process.exit();
};
