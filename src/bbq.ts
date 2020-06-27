#!/usr/bin/env node

'use strict';

import yargs from 'yargs';
import Config from './config';
import ResourceManager, * as rm from './resource_manager';
import Cache from './cache';
import fsize from 'filesize';
import { IAuth } from './config';
import sa from 'superagent';

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

const BBCloudCacheFilter: rm.ResourceId[] = [
  ['workspaces'],
  ['repositories', '*'],
  ['repositories', '*', '*', 'src', '**'],
];

class BitBucketCloud implements rm.IServer {
  auth: IAuth;
  url: string;
  cachePaths: rm.ResourceId[];
  constructor(auth: IAuth) {
    this.auth = auth;
    this.url = 'https://api.bitbucket.org/2.0';
    this.cachePaths = BBCloudCacheFilter;
  }
  setAuthorization(request: sa.SuperAgentRequest): sa.SuperAgentRequest {
    request
      .set('Content-Type', 'application/json')
      .set('Authorization', `Basic ${this.auth.password}`);
    return request;
  }
}

class JsonListHandler<U = any> implements rm.IDataHandler<U[]> {
  list: U[];
  pageIndex: number;
  maxPages: number;
  constructor(maxPages: number) {
    this.list = [];
    this.pageIndex = 0;
    this.maxPages = maxPages;
  }

  add(result: any): sa.SuperAgentRequest {
    let nextRequest: sa.SuperAgentRequest = null;
    this.list.push(...result.body.values);
    this.pageIndex += 1;
    let nextPage = result.body.next;
    if (nextPage && this.pageIndex < this.maxPages) {
      nextRequest = sa.get(nextPage);
    }
    return nextRequest;
  }

  get(): U[] {
    return this.list;
  }

  serialize(data: U[]): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): U[] {
    // TODO: catch errors
    return JSON.parse(data);
  }

  getCacheName(): string {
    return 'data.json';
  }
}

class BitBucket {
  config: Config;
  maxPages: number;
  manager: ResourceManager;
  constructor(config: Config, options: rm.IManagerOptions, maxPages: number) {
    this.config = config;
    this.maxPages = maxPages;
    this.manager = new ResourceManager(options);
    this.manager.registerServer('bb-cloud', new BitBucketCloud(config.auth));
  }

  async get(...id: string[]) {
    let resource: rm.IResource = {
      server: 'bb-cloud',
      id: id,
    };
    return await this.manager.get(resource, new JsonListHandler(this.maxPages));
  }

  async getWorkspaces() {
    return await this.get('workspaces');
  }

  async getPublicRepositories() {
    return await this.get('repositories');
  }

  async getRepositories(workspace: string) {
    return await this.get('repositories', workspace);
  }

  async getRepositorySrc(repo: IRepositoryPath, ...filePath: string[]) {
    return await this.get(
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

function getOptions(argv): rm.IManagerOptions {
  const managerOptions: rm.IManagerOptions = {
    verbose: argv.v,
    forceSynchronize: argv.s,
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

async function walkSourceTree(bb: BitBucket, repo: IRepositoryPath) {
  let rootFiles = await bb.getRepositorySrc(repo);
  if (rootFiles.length > 0) {
    let commit: string = rootFiles[0].commit.hash;
    // We fetch the same files again but through another endpoint
    let treeWalker = new SourceTreeWalker(bb, repo, commit);
    return await treeWalker.walkTree([]);
  }
  return null;
}

function formatRepository(repo: any): string {
  const isPrivate = repo.is_private === true ? 'private' : 'public';
  return `${repo.full_name} ${repo.language} ${repo.size} ${isPrivate}\n`;
}

const base = yargs
  .scriptName('bbq')
  .version('v0.0.1')
  .strict(true)
  .demandCommand()
  .option('v', {
    alias: 'verbose',
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .option('m', {
    alias: ['max-pages'],
    type: 'number',
    description: 'The maximum number of pages to fetch',
    default: 10,
  })
  .option('s', {
    alias: 'force-synchronization',
    type: 'boolean',
    description: 'Will force synchronization with the server',
    default: false,
  });
base.command(
  ['ws', 'workspace'],
  'Operations on workspaces',
  (yargs) =>
    yargs.option('l', {
      alias: 'list',
      type: 'boolean',
      description: 'List available workspaces',
      default: false,
    }),
  async (argv) => {
    let config = await getConfig();
    let bb = new BitBucket(config, getOptions(argv), argv.m);
    if (argv.l) {
      let workspaces = await bb.getWorkspaces();
      workspaces.forEach((workspace) =>
        terminal(`${workspace.slug} ${workspace.uuid}\n`)
      );
    } else {
      yargs.showHelp();
    }
    process.exit();
  }
);
base.command(['rp', 'repository'], 'Operations on repositories', (yargs) => {
  yargs.command(
    'show <repository>',
    'Show repository data',
    (yargs) =>
      yargs
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
        }),
    async (argv) => {
      let config = await getConfig();
      let bb = new BitBucket(config, getOptions(argv), argv.m);
      // For some reason TS does not understand the type
      let repoId: string = String(argv.repository);
      let repo = await bb.findRepository(repoId);
      if (!repo) {
        terminal.error(`Could not find repository ${argv.repository}\n`);
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
        terminal(formatRepository(repo));
      }
      process.exit();
    }
  );
  yargs.command(
    ['list', '$0'],
    'List repositories',
    (yargs) =>
      yargs.option('p', {
        alias: 'public',
        type: 'boolean',
        description: 'List public repositories',
        default: false,
      }),
    async (argv) => {
      let config = await getConfig();
      let bb = new BitBucket(config, getOptions(argv), argv.m);
      if (argv.public) {
        let values = await bb.getPublicRepositories();
        let names = values.map((ws) => ws.full_name);
        names.forEach((name) => terminal(`${name}\n`));
      } else {
        let workspaceIds = (await bb.getWorkspaces()).map((ws) => ws.uuid);
        for (let uuid of workspaceIds) {
          let repositories = await bb.getRepositories(uuid);
          repositories.forEach((repo) => terminal(formatRepository(repo)));
        }
      }
      process.exit();
    }
  );
});
base.command(
  ['cg', 'config'],
  'Handle your configuration',
  (yargs) =>
    yargs.option('c', {
      alias: 'clear',
      type: 'boolean',
      description: 'Clear your configuration',
      default: false,
    }),
  async (argv) => {
    let config = await getConfig();
    if (argv.clear) {
      await config.clearConfig();
    } else {
      yargs.showHelp();
    }
    process.exit();
  }
);
base.command(
  ['cc', 'cache'],
  'Handle your cache',
  (yargs) =>
    yargs.option('c', {
      alias: 'clear',
      type: 'boolean',
      description: 'Clear your cache',
      default: false,
    }),
  async (argv) => {
    let cache = new Cache({}, argv.v);
    if (argv.clear) {
      await cache.clear();
    } else {
      terminal(`Directory: ${cache.cacheDirectory}\n`);
      terminal(`Size: ${fsize(cache.getCacheSize())}\n`);
    }
    process.exit();
  }
);
yargs.argv;
