#!/usr/bin/env node

'use strict';

import yargs from 'yargs';
import Config from './config';
import ResourceManager, { IManagerOptions } from './resource_manager';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

terminal.on('key', (key: string) => {
  if (key === 'CTRL_C' || key === 'CTRL_D') {
    terminal.grabInput(false);
    process.exit();
  }
});

async function getConfig() {
  let config = new Config();
  if (!config.checkConfig()) {
    let configSetup = await config.setupConfig();
    if (!configSetup) {
      terminal('Config not loaded, aborting.\n');
      process.exit();
    }
  }
  return config;
}

interface IRepositoryPath {
  workspace: string;
  repository: string;
}

class BitBucket {
  config: Config;
  baseUrl: string;
  manager: ResourceManager;
  constructor(config: Config, options: IManagerOptions) {
    this.config = config;
    this.baseUrl = 'https://api.bitbucket.org/2.0';
    this.manager = new ResourceManager(this.config, options);
  }

  async getWorkspaces() {
    return await this.manager.getResource('workspaces');
  }

  async getPublicRepositories() {
    return await this.manager.getResource('repositories');
  }

  async getRepositories(workspace: string) {
    return await this.manager.getResource('repositories', workspace);
  }

  async getRepositorySrc(repo: IRepositoryPath, ...filePath: string[]) {
    return await this.manager.getResource(
      'repositories',
      repo.workspace,
      repo.repository,
      'src',
      ...filePath
    );
  }

  async findRepository(repository: string): Promise<any> {
    let workspaces = await this.getWorkspaces();
    for (let workspace of workspaces) {
      let repositories = await this.getRepositories(workspace.uuid);
      for (let repo of repositories) {
        if (repo.full_name === repository || repo.uuid === repository) {
          return repo;
        }
      }
    }
    return null;
  }
}

function getOptions(argv): IManagerOptions {
  const managerOptions: IManagerOptions = {
    verbose: argv.verbose,
    synchronize: argv.synchronize,
    maxPages: argv.maxPages,
  };
  return managerOptions;
}

class SourceTreeWalker {
  bb: BitBucket;
  repo: IRepositoryPath;
  commit: string;
  constructor(bb: BitBucket, repo: IRepositoryPath, commit: string) {
    this.bb = bb;
    this.repo = repo;
    this.commit = commit;
  }

  async walkTree(filePath: string = '') {
    let paths = [];
    let sourceFiles = await this.bb.getRepositorySrc(this.repo, this.commit, filePath);
    // TODO: consider escaped_path?
    for (let file of sourceFiles) {
      if (file.type === 'commit_file') {
        paths.push(file.path);
      } else {
        let directoryPaths = await this.walkTree(file.path);
        paths.push(...directoryPaths);
      }
    }
    return paths;
  }
}

async function walkSourceTree(bb: BitBucket, repo: IRepositoryPath) {
  let rootFiles = await bb.getRepositorySrc(repo);
  if (rootFiles.length > 0) {
    let commit: string = rootFiles[0].commit.hash;
    // We fetch the same files again but through another endpoint
    let treeWalker = new SourceTreeWalker(bb, repo, commit);
    return await treeWalker.walkTree();
  }
  return null;
}

yargs
  .scriptName('bbq')
  .version('v0.0.1')
  .strict(true)
  .demandCommand()
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .option('max-pages', {
    alias: 'm',
    type: 'number',
    description: 'The maximum number of pages to fetch',
    default: 10,
  })
  .option('synchronize', {
    alias: 's',
    type: 'boolean',
    description: 'Will force synchronization with the server',
    default: false,
  })
  .command(
    ['ws', 'workspace'],
    'Operations on workspaces',
    (yargs) => {
      yargs.option('list', {
        alias: 'l',
        type: 'boolean',
        description: 'List available workspaces',
        default: false,
      });
    },
    async (argv) => {
      let config = await getConfig();
      let bb = new BitBucket(config, getOptions(argv));
      if (argv.list) {
        let workspaces = await bb.getWorkspaces();
        workspaces.forEach((workspace) =>
          terminal(`${workspace.slug} ${workspace.uuid}\n`)
        );
      } else {
        yargs.showHelp();
      }
      process.exit();
    }
  )
  .command(
    ['rp', 'repository'],
    'Operations on repositories',
    (yargs) => {
      yargs
        .option('list', {
          alias: 'l',
          type: 'boolean',
          description: 'List your repositories',
          default: false,
        })
        .option('public', {
          alias: 'p',
          type: 'boolean',
          description: 'List public repositories',
          default: false,
        })
        .command(
          'show <repository>',
          'Show repository data',
          (yargs) => {
            yargs.positional('repository', {
              describe: 'Repository name/uuid',
              type: 'string',
              default: '',
            });
          },
          async (argv) => {
            let config = await getConfig();
            let bb = new BitBucket(config, getOptions(argv));
            // For some reason TS does not understand the type
            let repoId: string = String(argv.repository);
            let repo = await bb.findRepository(repoId);
            if (!repo) {
              terminal.error(`Could not find repository ${argv.repository}\n`);
              process.exit();
            }
            argv.verbose && terminal(`found ${repo.uuid} ${repo.full_name}\n`);
            let srcFiles = await walkSourceTree(bb, {
              workspace: repo.workspace.uuid,
              repository: repo.uuid,
            });
            srcFiles.forEach((file) => terminal(`${file}\n`));
            process.exit();
          }
        );
    },
    async (argv) => {
      let config = await getConfig();
      let bb = new BitBucket(config, getOptions(argv));
      if (argv.public) {
        let values = await bb.getPublicRepositories();
        let names = values.map((ws) => ws.full_name);
        names.forEach((name) => terminal(`${name}\n`));
      }
      if (argv.list) {
        let workspaceIds = (await bb.getWorkspaces()).map((ws) => ws.uuid);
        for (let uuid of workspaceIds) {
          let repositories = await bb.getRepositories(uuid);
          repositories.forEach((repo) => terminal(`${repo.full_name} ${repo.uuid}\n`));
        }
      } else {
        yargs.showHelp();
      }
      process.exit();
    }
  )
  .command(
    ['cg', 'config'],
    'Handle your configuration',
    (yargs) => {
      yargs.option('clear', {
        alias: 'c',
        type: 'boolean',
        description: 'Clear your configuration',
        default: false,
      });
    },
    async (argv) => {
      let config = await getConfig();
      if (argv.clear) {
        await config.clearConfig();
      } else {
        yargs.showHelp();
      }
      process.exit();
    }
  ).argv;
